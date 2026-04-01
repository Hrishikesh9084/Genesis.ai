import db from '../config/db.js';
import deployService from '../services/deployService.js';

let ensureDeploymentColumnsPromise;

function resolveTarget(value) {
  if (value === 'frontend' || value === 'backend' || value === 'fullstack') {
    return value;
  }

  return 'fullstack';
}

function requiresGithubRepo(target) {
  return target === 'backend' || target === 'fullstack';
}

function ensureDeploymentColumns() {
  if (!ensureDeploymentColumnsPromise) {
    ensureDeploymentColumnsPromise = db
      .query(`
        ALTER TABLE IF EXISTS projects
        ADD COLUMN IF NOT EXISTS deploy_frontend_url TEXT;

        ALTER TABLE IF EXISTS projects
        ADD COLUMN IF NOT EXISTS deploy_backend_url TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS vercel_token TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS render_api_key TEXT;

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS render_owner_id TEXT;
      `)
      .catch((err) => {
        ensureDeploymentColumnsPromise = null;
        throw err;
      });
  }

  return ensureDeploymentColumnsPromise;
}

const deployProject = async (req, res, next) => {
  try {
    await ensureDeploymentColumns();

    const target = resolveTarget(req.body?.target);
    const { id } = req.params;

    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projectResult.rows[0];

    if (project.status !== 'ready') {
      return res.status(400).json({ error: 'Project is not ready for deployment.' });
    }

    if (requiresGithubRepo(target) && !project.github_repo_url) {
      return res.status(400).json({ error: 'Push code to GitHub before deploying.' });
    }

    const keyResult = await db.query(
      'SELECT vercel_token, render_api_key, render_owner_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const keys = keyResult.rows[0] || {};

    if ((target === 'frontend' || target === 'fullstack') && !keys.vercel_token) {
      return res.status(400).json({ error: 'Vercel key not configured. Add it in Settings.' });
    }

    if ((target === 'backend' || target === 'fullstack') && !keys.render_api_key) {
      return res.status(400).json({ error: 'Render key not configured. Add it in Settings.' });
    }

    const deployments = [];

    if (target === 'frontend' || target === 'fullstack') {
      const frontendResult = await db.query(
        'INSERT INTO deployments (project_id, platform, status) VALUES ($1, $2, $3) RETURNING *',
        [id, 'vercel-frontend', 'deploying']
      );
      deployments.push(frontendResult.rows[0]);
    }

    if (target === 'backend' || target === 'fullstack') {
      const backendResult = await db.query(
        'INSERT INTO deployments (project_id, platform, status) VALUES ($1, $2, $3) RETURNING *',
        [id, 'render-backend', 'deploying']
      );
      deployments.push(backendResult.rows[0]);
    }

    deployAsync({
      project,
      target,
      deployments,
      userKeys: {
        vercelToken: keys.vercel_token,
        renderApiKey: keys.render_api_key,
        renderOwnerId: keys.render_owner_id,
      },
    });

    res.json({ deployments, target });
  } catch (err) {
    next(err);
  }
};

async function markDeploymentFailed(deploymentId, message) {
  await db.query(
    'UPDATE deployments SET status = $1, logs = $2, updated_at = NOW() WHERE id = $3',
    ['failed', message, deploymentId]
  );
}

async function deployAsync({ project, target, deployments, userKeys }) {
  try {
    const frontendDeployment = deployments.find((dep) => dep.platform === 'vercel-frontend');
    const backendDeployment = deployments.find((dep) => dep.platform === 'render-backend');

    let backendResult = null;
    let frontendResult = null;

    if (backendDeployment) {
      try {
        backendResult = await deployService.deployBackendToRender(project, {
          apiKey: userKeys.renderApiKey,
          ownerId: userKeys.renderOwnerId,
        });

        await db.query(
          'UPDATE deployments SET status = $1, url = $2, deploy_id = $3, updated_at = NOW() WHERE id = $4',
          ['deployed', backendResult.url, backendResult.deployId, backendDeployment.id]
        );
      } catch (err) {
        await markDeploymentFailed(backendDeployment.id, err.message);
      }
    }

    if (frontendDeployment) {
      try {
        frontendResult = await deployService.deployFrontendToVercel(project, {
          token: userKeys.vercelToken,
          backendUrl: backendResult?.url,
        });

        await db.query(
          'UPDATE deployments SET status = $1, url = $2, deploy_id = $3, updated_at = NOW() WHERE id = $4',
          ['deployed', frontendResult.url, frontendResult.deployId, frontendDeployment.id]
        );
      } catch (err) {
        await markDeploymentFailed(frontendDeployment.id, err.message);
      }
    }

    if (backendResult?.serviceId && frontendResult?.url) {
      try {
        await deployService.updateRenderBackendEnv({
          apiKey: userKeys.renderApiKey,
          serviceId: backendResult.serviceId,
          frontendUrl: frontendResult.url,
        });
      } catch (err) {
        if (backendDeployment) {
          await db.query(
            'UPDATE deployments SET logs = COALESCE(logs, $1) || $2, updated_at = NOW() WHERE id = $3',
            ['', `\nRender env sync warning: ${err.message}`, backendDeployment.id]
          );
        }
      }
    }

    const hasRequestedFrontend = target === 'frontend' || target === 'fullstack';
    const hasRequestedBackend = target === 'backend' || target === 'fullstack';
    const frontendOk = !hasRequestedFrontend || Boolean(frontendResult?.url);
    const backendOk = !hasRequestedBackend || Boolean(backendResult?.url);
    const overallStatus = frontendOk && backendOk ? 'deployed' : 'ready';
    const deployPlatform =
      target === 'fullstack' ? 'vercel+render' : target === 'frontend' ? 'vercel' : 'render';

    await db.query(
      `UPDATE projects
       SET deploy_url = $1,
           deploy_frontend_url = COALESCE($2, deploy_frontend_url),
           deploy_backend_url = COALESCE($3, deploy_backend_url),
           deploy_platform = $4,
           status = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        frontendResult?.url || backendResult?.url || project.deploy_url,
        frontendResult?.url || null,
        backendResult?.url || null,
        deployPlatform,
        overallStatus,
        project.id,
      ]
    );
  } catch (err) {
    console.error('Deployment failed:', err);
    await Promise.all(
      deployments.map((dep) => markDeploymentFailed(dep.id, err.message))
    );
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
    const result = await db.query('SELECT * FROM deployments WHERE id = $1', [req.params.deployId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deployment not found.' });
    }

    res.json({ deployment: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

export default {
  deployProject,
  getDeployments,
  getDeploymentStatus,
};
