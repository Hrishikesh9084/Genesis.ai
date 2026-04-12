import db from '../config/db.js';
import deployService from '../services/deployService.js';
import domainService from '../services/domainService.js';
import { getEnvVarsRaw } from './envVarsController.js';
import { createDeploymentLogger } from '../deploy/logger.js';

let ensureDeploymentKeyColumnsPromise;
let ensureManagedDeploymentColumnsPromise;
const activeDeploymentLoggers = new Map();

function registerDeploymentLogger(deploymentId, logger) {
  if (!deploymentId || !logger) return;
  activeDeploymentLoggers.set(String(deploymentId), logger);
}

function releaseDeploymentLogger(deploymentId) {
  if (!deploymentId) return;
  activeDeploymentLoggers.delete(String(deploymentId));
}

function getLiveDeploymentLogs(deploymentId) {
  if (!deploymentId) return '';
  const logger = activeDeploymentLoggers.get(String(deploymentId));
  return logger?.dump?.() || '';
}

function getActiveDeploymentLogger(deploymentId) {
  if (!deploymentId) return null;
  return activeDeploymentLoggers.get(String(deploymentId)) || null;
}

async function getDeploymentLogsPayload({ deployId, userId }) {
  await ensureManagedDeploymentColumns();

  const result = await db.query(
    `SELECT d.*, p.user_id AS owner_id
     FROM deployments d
     JOIN projects p ON p.id = d.project_id
     WHERE d.id = $1
     LIMIT 1`,
    [deployId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Deployment not found.');
    err.statusCode = 404;
    throw err;
  }

  const deployment = result.rows[0];
  if (String(deployment.owner_id) !== String(userId)) {
    const err = new Error('Deployment not found.');
    err.statusCode = 404;
    throw err;
  }

  let runtimeLogs = '';
  if (deployment.platform === 'genesis-managed' && deployment.runtime_id) {
    runtimeLogs = await deployService.getManagedDeploymentLogs({
      runtimeId: deployment.runtime_id,
      runtimeType: deployment.runtime_type,
    });
  }

  const liveLogs = getLiveDeploymentLogs(deployment.id);
  const logs = [runtimeLogs, liveLogs, deployment.logs || ''].filter(Boolean).join('\n').trim();

  return {
    deploymentId: deployment.id,
    status: deployment.status,
    logs,
    url: deployment.url || null,
    platform: deployment.platform,
    deployId: deployment.deploy_id || null,
    runtimeId: deployment.runtime_id || null,
    runtimeType: deployment.runtime_type || null,
    updatedAt: deployment.updated_at,
  };
}

function ensureDeploymentKeyColumns() {
  if (!ensureDeploymentKeyColumnsPromise) {
    ensureDeploymentKeyColumnsPromise = db
      .query(`
        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS vercel_token TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS render_api_key TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS render_owner_id TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_vps_host TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_vps_user TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_vps_port INTEGER;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_vps_ssh_private_key TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_domain TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_api_domain TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_ssl_email TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_provider TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS docker_cloud_enable_kubernetes BOOLEAN DEFAULT FALSE;
      `)
      .catch((err) => {
        ensureDeploymentKeyColumnsPromise = null;
        throw err;
      });
  }

  return ensureDeploymentKeyColumnsPromise;
}

function ensureManagedDeploymentColumns() {
  if (!ensureManagedDeploymentColumnsPromise) {
    ensureManagedDeploymentColumnsPromise = db
      .query(`
        ALTER TABLE IF EXISTS deployments
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

        ALTER TABLE IF EXISTS deployments
        ADD COLUMN IF NOT EXISTS subdomain VARCHAR(63);

        ALTER TABLE IF EXISTS deployments
        ADD COLUMN IF NOT EXISTS runtime_type VARCHAR(30);

        ALTER TABLE IF EXISTS deployments
        ADD COLUMN IF NOT EXISTS runtime_id TEXT;

        ALTER TABLE IF EXISTS deployments
        ADD COLUMN IF NOT EXISTS runtime_port INTEGER;

        CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id);
        CREATE INDEX IF NOT EXISTS idx_deployments_runtime_id ON deployments(runtime_id);
      `)
      .catch((err) => {
        ensureManagedDeploymentColumnsPromise = null;
        throw err;
      });
  }

  return ensureManagedDeploymentColumnsPromise;
}

async function runManagedDeploymentAsync({ deploymentId, project, userId, subdomain, logger }) {
  try {
    // Fetch user-defined environment variables for this project
    const userEnvVars = await getEnvVarsRaw(project.id, userId);

    const deployment = await deployService.deployManagedProject({
      project,
      subdomain,
      logger,
      userEnvVars,
    });

    await db.query(
      `UPDATE deployments
       SET status = $1,
           url = $2,
           deploy_id = $3,
           subdomain = $4,
           runtime_type = $5,
           runtime_id = $6,
           runtime_port = $7,
           logs = $8,
           updated_at = NOW()
       WHERE id = $9`,
      [
        'deployed',
        deployment.url,
        deployment.deployId,
        deployment.subdomain,
        deployment.runtimeType,
        deployment.runtimeId,
        deployment.port,
        logger?.dump?.() || null,
        deploymentId,
      ]
    );

    await db.query(
      `UPDATE projects
       SET deploy_url = $1,
           deploy_frontend_url = $1,
           deploy_platform = $2,
           status = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [deployment.url, 'genesis-managed', 'deployed', project.id]
    );

    await logger?.info?.('Managed deployment completed.', {
      deploymentId,
      projectId: project.id,
      subdomain: deployment.subdomain,
      url: deployment.url,
      runtimeType: deployment.runtimeType,
      runtimeId: deployment.runtimeId,
    });
  } catch (err) {
    await logger?.error?.('Managed deployment failed.', { error: err.message, deploymentId, projectId: project.id });

    try {
      await db.query(
        `UPDATE deployments
         SET status = $1,
             logs = $2,
             updated_at = NOW()
         WHERE id = $3`,
        ['failed', logger?.dump?.() || err.message, deploymentId]
      );
    } catch (dbErr) {
      console.error('Failed to persist managed deployment failure state:', dbErr.message);
    }
  } finally {
    releaseDeploymentLogger(deploymentId);
  }
}

const deployProject = async (req, res, next) => {
  try {
    const { platform: requestedPlatform } = req.body || {};
    const externalProvidersAllowed =
      String(process.env.GENESIS_ALLOW_EXTERNAL_DEPLOY_PROVIDERS || 'false').toLowerCase() === 'true';
    const platform = requestedPlatform || 'genesis-managed';
    const { id } = req.params;

    if (!['genesis-managed', 'vercel', 'render', 'docker-cloud'].includes(platform)) {
      return res.status(400).json({ error: 'Platform must be "genesis-managed", "vercel", "render", or "docker-cloud".' });
    }

    if (!externalProvidersAllowed && ['vercel', 'render', 'docker-cloud'].includes(platform)) {
      return res.status(400).json({
        error: 'External deployment providers are disabled. Use platform "genesis-managed" for zero-config deployment.',
      });
    }

    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projectResult.rows[0];

    await ensureDeploymentKeyColumns();

    const userKeyResult = await db.query(
      `SELECT
         vercel_token,
         render_api_key,
         render_owner_id,
         docker_cloud_vps_host,
         docker_cloud_vps_user,
         docker_cloud_vps_port,
         docker_cloud_vps_ssh_private_key,
         docker_cloud_domain,
         docker_cloud_api_domain,
         docker_cloud_ssl_email,
         docker_cloud_provider,
         docker_cloud_enable_kubernetes
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    const userKeys = userKeyResult.rows[0] || {};

    if (project.status !== 'ready') {
      return res.status(400).json({ error: 'Project is not ready for deployment.' });
    }

    if (platform !== 'genesis-managed' && !project.github_repo_url) {
      return res.status(400).json({ error: 'Push code to GitHub before deploying.' });
    }

    await ensureManagedDeploymentColumns();

    if (platform === 'genesis-managed') {
      await domainService.ensureDomainsSchema();
      const domain = await domainService.reserveProjectDomain({
        userId: req.user.id,
        project,
        preferredSubdomain: req.body.subdomain || project.name,
      });

      const generatedUrl = `http://${domain.subdomain}.${process.env.GENESIS_DEPLOY_BASE_DOMAIN || 'genesisapp.in'}`;
      
      // Update projects table instantly so the UI gets the live URL immediately
      await db.query(
        `UPDATE projects
         SET deploy_url = $1,
             deploy_platform = $2
         WHERE id = $3`,
        [generatedUrl, 'genesis-managed', project.id]
      );

      const deployResult = await db.query(
        `INSERT INTO deployments (project_id, user_id, platform, status, subdomain, logs, url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, req.user.id, 'genesis-managed', 'deploying', domain.subdomain, 'Queued for managed deployment', generatedUrl]
      );

      const deployment = deployResult.rows[0];
      const logger = createDeploymentLogger(project.name || project.id);
      registerDeploymentLogger(deployment.id, logger);
      await logger.info('Queued managed deployment from deployProject.', {
        deploymentId: deployment.id,
        projectId: project.id,
        userId: req.user.id,
        subdomain: domain.subdomain,
      });

      runManagedDeploymentAsync({
        deploymentId: deployment.id,
        project,
        userId: req.user.id,
        subdomain: domain.subdomain,
        logger,
      }).catch((error) => {
        console.error('Unhandled managed deploy async error:', error);
      });

      return res.status(202).json({ deployment });
    }

    const deployResult = await db.query(
      'INSERT INTO deployments (project_id, platform, status) VALUES ($1, $2, $3) RETURNING *',
      [id, platform, 'deploying']
    );

    const deployment = deployResult.rows[0];

    const credentials = {
      vercelToken: userKeys.vercel_token || null,
      renderApiKey: userKeys.render_api_key || null,
      renderOwnerId: userKeys.render_owner_id || null,
      vpsHost: userKeys.docker_cloud_vps_host || null,
      vpsUser: userKeys.docker_cloud_vps_user || null,
      vpsPort: userKeys.docker_cloud_vps_port || null,
      vpsSshPrivateKey: userKeys.docker_cloud_vps_ssh_private_key || null,
      deployDomain: userKeys.docker_cloud_domain || null,
      deployApiDomain: userKeys.docker_cloud_api_domain || null,
      sslEmail: userKeys.docker_cloud_ssl_email || null,
      cloudProvider: userKeys.docker_cloud_provider || null,
      enableKubernetes: userKeys.docker_cloud_enable_kubernetes || false,
    };

    deployAsync(deployment.id, project, platform, credentials).catch((error) => {
      console.error('Unhandled deployAsync error:', error);
    });

    res.json({ deployment });
  } catch (err) {
    next(err);
  }
};

async function deployAsync(deploymentId, project, platform, credentials) {
  try {
    let result;

    if (platform === 'vercel') {
      result = await deployService.deployToVercel(project, credentials);
    } else if (platform === 'render') {
      result = await deployService.deployToRender(project, credentials);
    } else {
      result = await deployService.deployToDockerCloud(project, credentials);
    }

    await db.query(
      'UPDATE deployments SET status = $1, url = $2, deploy_id = $3, updated_at = NOW() WHERE id = $4',
      ['deployed', result.url, result.deployId, deploymentId]
    );

    await db.query(
      'UPDATE projects SET deploy_url = $1, deploy_platform = $2, status = $3, updated_at = NOW() WHERE id = $4',
      [result.url, platform, 'deployed', project.id]
    );
  } catch (err) {
    console.error('Deployment failed:', err);
    try {
      await db.query(
        'UPDATE deployments SET status = $1, logs = $2, updated_at = NOW() WHERE id = $3',
        ['failed', err.message, deploymentId]
      );
    } catch (dbErr) {
      console.error('Failed to persist deployment failure state:', dbErr.message);
    }
  }
}

const getDeployments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const result = await db.query(
      'SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({ deployments: result.rows });
  } catch (err) {
    next(err);
  }
};

const getDeploymentStatus = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT d.*
       FROM deployments d
       JOIN projects p ON p.id = d.project_id
       WHERE d.id = $1 AND p.user_id = $2
       LIMIT 1`,
      [req.params.deployId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deployment not found.' });
    }

    res.json({ deployment: result.rows[0] });
  } catch (err) {
    const message = String(err?.message || '').toLowerCase();
    const code = String(err?.code || err?.errno || '').toLowerCase();
    const isTransientDbIssue =
      ['enotfound', 'econnrefused', 'econnreset', 'etimedout', 'econntimedout'].includes(code) ||
      message.includes('getaddrinfo') ||
      message.includes('enotfound') ||
      message.includes('connection refused') ||
      message.includes('connection reset') ||
      message.includes('timeout');

    if (isTransientDbIssue) {
      return res.status(503).json({
        error: 'Deployment status is temporarily unavailable.',
      });
    }

    next(err);
  }
};

const deployManaged = async (req, res, next) => {
  const logger = createDeploymentLogger(req.body?.projectName || req.body?.projectId || 'managed-deploy');

  try {
    const { projectId, subdomain } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required.' });
    }

    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1', [
      projectId,
      req.user.id,
    ]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projectResult.rows[0];
    if (!project.files) {
      return res.status(400).json({ error: 'Project has no generated files to deploy.' });
    }

    await logger.info('Starting managed deployment.', {
      projectId,
      subdomain,
      userId: req.user.id,
    });

    await domainService.ensureDomainsSchema();

    const domain = subdomain
      ? await domainService.reassignProjectDomain({
          userId: req.user.id,
          projectId: project.id,
          requestedSubdomain: subdomain,
        })
      : await domainService.reserveProjectDomain({
          userId: req.user.id,
          project,
          preferredSubdomain: project.name,
        });

    await ensureManagedDeploymentColumns();

    const deployResult = await db.query(
      `INSERT INTO deployments (project_id, user_id, platform, status, subdomain, url, logs)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [project.id, req.user.id, 'genesis-managed', 'deploying', domain.subdomain, domain.deploymentUrl || null, logger.dump()]
    );

    registerDeploymentLogger(deployResult.rows[0].id, logger);

    runManagedDeploymentAsync({
      deploymentId: deployResult.rows[0].id,
      project,
      userId: req.user.id,
      subdomain: domain.subdomain,
      logger,
    }).catch((error) => {
      console.error('Unhandled managed deploy async error:', error);
    });

    return res.status(202).json({
      success: true,
      deployment: { ...deployResult.rows[0], url: domain.deploymentUrl },
      subdomain: domain.subdomain,
    });
  } catch (err) {
    await logger.error('Managed deployment failed.', { error: err.message });
    return next(err);
  }
};

const getDeploymentLogs = async (req, res, next) => {
  try {
    const payload = await getDeploymentLogsPayload({
      deployId: req.params.deployId,
      userId: req.user.id,
    });

    return res.json(payload);
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message || 'Deployment logs unavailable.' });
    }
    next(err);
  }
};

const streamDeploymentLogs = async (req, res, next) => {
  let heartbeatInterval;
  let pollInterval;
  let unsubscribeLogger = () => {};
  let closed = false;
  let sending = false;
  let lastSignature = '';

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (pollInterval) clearInterval(pollInterval);
    unsubscribeLogger();
  };

  const writeEvent = (event, payload) => {
    if (closed) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.flush?.();
  };

  try {
    const initialPayload = await getDeploymentLogsPayload({
      deployId: req.params.deployId,
      userId: req.user.id,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write('retry: 1500\n\n');
    res.flush?.();

    const pushSnapshot = async (force = false) => {
      if (closed || sending) return;
      sending = true;
      try {
        const payload = await getDeploymentLogsPayload({
          deployId: req.params.deployId,
          userId: req.user.id,
        });

        const nextSignature = `${payload.status}::${payload.logs}`;
        if (force || nextSignature !== lastSignature) {
          lastSignature = nextSignature;
          writeEvent('deployment-log', payload);
        }

        if (['deployed', 'failed', 'stopped'].includes(String(payload.status))) {
          writeEvent('complete', payload);
          cleanup();
          res.end();
        }
      } catch (error) {
        writeEvent('error', { error: error?.message || 'Failed to stream deployment logs.' });
      } finally {
        sending = false;
      }
    };

    const logger = getActiveDeploymentLogger(req.params.deployId);
    if (logger?.subscribe) {
      unsubscribeLogger = logger.subscribe(() => {
        pushSnapshot(true).catch(() => {});
      });
    }

    lastSignature = `${initialPayload.status}::${initialPayload.logs}`;
    writeEvent('deployment-log', initialPayload);

    if (['deployed', 'failed', 'stopped'].includes(String(initialPayload.status))) {
      writeEvent('complete', initialPayload);
      cleanup();
      return res.end();
    }

    pollInterval = setInterval(() => {
      pushSnapshot(false).catch(() => {});
    }, 1500);

    heartbeatInterval = setInterval(() => {
      if (!closed) {
        res.write(': keep-alive\n\n');
        res.flush?.();
      }
    }, 15000);

    req.on('close', cleanup);
  } catch (err) {
    next(err);
  }
};

const stopDeployment = async (req, res, next) => {
  try {
    await ensureManagedDeploymentColumns();

    const result = await db.query(
      `SELECT d.*, p.user_id AS owner_id
       FROM deployments d
       JOIN projects p ON p.id = d.project_id
       WHERE d.id = $1
       LIMIT 1`,
      [req.params.deployId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deployment not found.' });
    }

    const deployment = result.rows[0];
    if (String(deployment.owner_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Deployment not found.' });
    }

    if (deployment.platform !== 'genesis-managed') {
      return res.status(400).json({ error: 'Stop is supported only for genesis-managed deployments.' });
    }

    await deployService.stopManagedDeploymentByRuntimeId(deployment.runtime_id || deployment.deploy_id, deployment.runtime_type || 'pm2');

    await db.query(
      `UPDATE deployments
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      ['stopped', deployment.id]
    );

    await db.query(
      `UPDATE projects
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      ['ready', deployment.project_id]
    );

    return res.json({ success: true, deploymentId: deployment.id, status: 'stopped' });
  } catch (err) {
    next(err);
  }
};

const redeployManaged = async (req, res, next) => {
  try {
    req.body = {
      ...(req.body || {}),
      projectId: req.params.id,
    };

    return deployManaged(req, res, next);
  } catch (err) {
    next(err);
  }
};

export default {
  deployProject,
  deployManaged,
  redeployManaged,
  getDeployments,
  getDeploymentStatus,
  getDeploymentLogs,
  streamDeploymentLogs,
  stopDeployment,
};