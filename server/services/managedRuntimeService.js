import db from '../config/db.js';
import deployService from './deployService.js';

const DEFAULT_POLICY = {
  memory_limit_mb: 512,
  cpu_limit_percent: 100,
  auto_sleep_enabled: true,
  sleep_after_seconds: 900,
  auto_restart_enabled: true,
  max_restarts_per_hour: 3,
};

let ensureSchemaPromise;
let supervisorInterval;
const restartHistory = new Map();

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

async function ensureSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = db
      .query(`
        CREATE TABLE IF NOT EXISTS project_runtime_policies (
          project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
          memory_limit_mb INTEGER NOT NULL DEFAULT 512,
          cpu_limit_percent INTEGER NOT NULL DEFAULT 100,
          auto_sleep_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          sleep_after_seconds INTEGER NOT NULL DEFAULT 900,
          auto_restart_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          max_restarts_per_hour INTEGER NOT NULL DEFAULT 3,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS deployment_runtime_bindings (
          deployment_id UUID PRIMARY KEY REFERENCES deployments(id) ON DELETE CASCADE,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          component VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_runtime_bindings_project ON deployment_runtime_bindings(project_id);
      `)
      .catch((err) => {
        ensureSchemaPromise = null;
        throw err;
      });
  }

  return ensureSchemaPromise;
}

async function getPolicy(projectId, client = db) {
  await ensureSchema();

  await client.query(
    `INSERT INTO project_runtime_policies (
       project_id,
       memory_limit_mb,
       cpu_limit_percent,
       auto_sleep_enabled,
       sleep_after_seconds,
       auto_restart_enabled,
       max_restarts_per_hour
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (project_id) DO NOTHING`,
    [
      projectId,
      DEFAULT_POLICY.memory_limit_mb,
      DEFAULT_POLICY.cpu_limit_percent,
      DEFAULT_POLICY.auto_sleep_enabled,
      DEFAULT_POLICY.sleep_after_seconds,
      DEFAULT_POLICY.auto_restart_enabled,
      DEFAULT_POLICY.max_restarts_per_hour,
    ]
  );

  const result = await client.query('SELECT * FROM project_runtime_policies WHERE project_id = $1 LIMIT 1', [projectId]);
  return result.rows[0] || { project_id: projectId, ...DEFAULT_POLICY };
}

async function updatePolicy({ userId, projectId, updates }) {
  await ensureSchema();

  const ownership = await db.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1', [projectId, userId]);
  if (ownership.rows.length === 0) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }

  const current = await getPolicy(projectId);

  const nextValues = {
    memory_limit_mb: clamp(toInt(updates?.memory_limit_mb ?? updates?.memoryLimitMb, current.memory_limit_mb), 128, 4096),
    cpu_limit_percent: clamp(toInt(updates?.cpu_limit_percent ?? updates?.cpuLimitPercent, current.cpu_limit_percent), 10, 100),
    auto_sleep_enabled: parseBoolean(
      updates?.auto_sleep_enabled ?? updates?.autoSleepEnabled,
      current.auto_sleep_enabled
    ),
    sleep_after_seconds: clamp(toInt(updates?.sleep_after_seconds ?? updates?.sleepAfterSeconds, current.sleep_after_seconds), 60, 86400),
    auto_restart_enabled: parseBoolean(
      updates?.auto_restart_enabled ?? updates?.autoRestartEnabled,
      current.auto_restart_enabled
    ),
    max_restarts_per_hour: clamp(
      toInt(updates?.max_restarts_per_hour ?? updates?.maxRestartsPerHour, current.max_restarts_per_hour),
      0,
      20
    ),
  };

  await db.query(
    `INSERT INTO project_runtime_policies (
      project_id,
      memory_limit_mb,
      cpu_limit_percent,
      auto_sleep_enabled,
      sleep_after_seconds,
      auto_restart_enabled,
      max_restarts_per_hour,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (project_id)
    DO UPDATE SET
      memory_limit_mb = EXCLUDED.memory_limit_mb,
      cpu_limit_percent = EXCLUDED.cpu_limit_percent,
      auto_sleep_enabled = EXCLUDED.auto_sleep_enabled,
      sleep_after_seconds = EXCLUDED.sleep_after_seconds,
      auto_restart_enabled = EXCLUDED.auto_restart_enabled,
      max_restarts_per_hour = EXCLUDED.max_restarts_per_hour,
      updated_at = NOW()`,
    [
      projectId,
      nextValues.memory_limit_mb,
      nextValues.cpu_limit_percent,
      nextValues.auto_sleep_enabled,
      nextValues.sleep_after_seconds,
      nextValues.auto_restart_enabled,
      nextValues.max_restarts_per_hour,
    ]
  );

  return getPolicy(projectId);
}

async function bindDeployment({ deploymentId, projectId, component }) {
  if (!deploymentId || !projectId || !component) return;

  await ensureSchema();
  await db.query(
    `INSERT INTO deployment_runtime_bindings (deployment_id, project_id, component, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (deployment_id)
     DO UPDATE SET
       project_id = EXCLUDED.project_id,
       component = EXCLUDED.component,
       updated_at = NOW()`,
    [deploymentId, projectId, component]
  );
}

async function getBoundDeploymentIds(projectId, component) {
  await ensureSchema();

  const params = [projectId];
  let where = 'WHERE project_id = $1';
  if (component) {
    params.push(component);
    where += ' AND component = $2';
  }

  const result = await db.query(
    `SELECT deployment_id
     FROM deployment_runtime_bindings
     ${where}
     ORDER BY updated_at DESC`,
    params
  );

  return result.rows.map((row) => row.deployment_id);
}

async function appendRuntimeLog(projectId, message, options = {}) {
  if (!projectId || !message) return;

  const component = options.component || null;
  const deploymentIds = await getBoundDeploymentIds(projectId, component);
  if (deploymentIds.length === 0) return;

  await Promise.all(
    deploymentIds.map((deploymentId) =>
      db.query(
        `UPDATE deployments
         SET logs = COALESCE(logs, '') || $1,
             updated_at = NOW()
         WHERE id = $2`,
        [`\n${message}`, deploymentId]
      )
    )
  );
}

async function setBoundDeploymentStatus(projectId, status, options = {}) {
  const component = options.component || null;
  const deploymentIds = await getBoundDeploymentIds(projectId, component);
  if (deploymentIds.length === 0) return;

  await Promise.all(
    deploymentIds.map((deploymentId) =>
      db.query(
        `UPDATE deployments
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [status, deploymentId]
      )
    )
  );
}

async function restoreManagedDeploymentsOnStartup() {
  if (!deployService.isManagedEngine()) return;

  await ensureSchema();

  const result = await db.query(
    `SELECT p.*
     FROM projects p
     WHERE p.status IN ('deployed', 'sleeping')
       AND p.deploy_platform = 'genesis-managed'
       AND p.files IS NOT NULL`
  );

  for (const project of result.rows) {
    try {
      const policy = await getPolicy(project.id);
      await deployService.reconcileManagedDeployment(project, {
        forceRestart: true,
        runtimePolicy: policy,
      });
      await setBoundDeploymentStatus(project.id, 'deployed');
      await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', ['deployed', project.id]);
      await appendRuntimeLog(project.id, 'Managed runtime restored after server restart.');
    } catch (err) {
      await appendRuntimeLog(project.id, `Managed runtime restore failed: ${err.message}`);
    }
  }
}

function canRestartNow(projectId, maxPerHour) {
  const now = Date.now();
  const windowStart = now - 3600 * 1000;
  const existing = (restartHistory.get(projectId) || []).filter((stamp) => stamp >= windowStart);

  if (existing.length >= maxPerHour) {
    restartHistory.set(projectId, existing);
    return false;
  }

  existing.push(now);
  restartHistory.set(projectId, existing);
  return true;
}

async function supervisorTick() {
  if (!deployService.isManagedEngine()) return;

  const active = deployService.listManagedDeployments();
  const now = Date.now();

  for (const deployment of active) {
    const projectId = deployment.projectId;
    const status = deployment.status || {};

    const policy = await getPolicy(projectId);
    const sleepAfterMs = Number(policy.sleep_after_seconds || DEFAULT_POLICY.sleep_after_seconds) * 1000;
    const lastAccessAt = Number(status.lastAccessAt || status.startedAt || now);

    if (policy.auto_sleep_enabled && status.status === 'running' && now - lastAccessAt > sleepAfterMs) {
      await deployService.stopManagedDeploymentByProject(projectId);
      await setBoundDeploymentStatus(projectId, 'sleeping');
      await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', ['sleeping', projectId]);
      await appendRuntimeLog(projectId, `Auto-sleep activated after ${policy.sleep_after_seconds}s of inactivity.`);
      continue;
    }

    const shouldAutoRestart = policy.auto_restart_enabled && (status.status === 'error' || status.status === 'stopped');
    if (shouldAutoRestart) {
      const maxPerHour = Number(policy.max_restarts_per_hour || DEFAULT_POLICY.max_restarts_per_hour);
      if (!canRestartNow(projectId, maxPerHour)) {
        await appendRuntimeLog(projectId, `Auto-restart skipped: max restarts per hour (${maxPerHour}) reached.`);
        continue;
      }

      const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 LIMIT 1', [projectId]);
      const project = projectResult.rows[0];
      if (!project?.files) {
        await appendRuntimeLog(projectId, 'Auto-restart skipped: project files are not available.');
        continue;
      }

      try {
        await deployService.reconcileManagedDeployment(project, {
          forceRestart: true,
          runtimePolicy: policy,
        });
        await setBoundDeploymentStatus(projectId, 'deployed');
        await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', ['deployed', projectId]);
        await appendRuntimeLog(projectId, 'Managed runtime auto-restarted successfully.');
      } catch (err) {
        await setBoundDeploymentStatus(projectId, 'failed');
        await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', ['failed', projectId]);
        await appendRuntimeLog(projectId, `Managed runtime auto-restart failed: ${err.message}`);
      }
    }
  }
}

async function initManagedRuntimeSupervisor() {
  await ensureSchema();

  if (!deployService.isManagedEngine()) {
    return;
  }

  await restoreManagedDeploymentsOnStartup();

  if (!supervisorInterval) {
    const tickMs = Math.max(10000, toInt(process.env.MANAGED_SUPERVISOR_INTERVAL_MS, 30000));
    supervisorInterval = setInterval(() => {
      supervisorTick().catch((err) => {
        console.error('Managed runtime supervisor tick failed:', err.message);
      });
    }, tickMs);
  }
}

function stopManagedRuntimeSupervisor() {
  if (supervisorInterval) {
    clearInterval(supervisorInterval);
    supervisorInterval = null;
  }
}

export default {
  ensureSchema,
  getPolicy,
  updatePolicy,
  bindDeployment,
  appendRuntimeLog,
  initManagedRuntimeSupervisor,
  stopManagedRuntimeSupervisor,
};
