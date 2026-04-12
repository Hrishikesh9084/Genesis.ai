import deployService from '../services/deployService.js';

function getVercelConfig() {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID || undefined;

  if (!token) {
    throw new Error('VERCEL_TOKEN is required for frontend deployment.');
  }

  return { token, teamId };
}

function queryString(teamId) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

async function callVercel(path, token, method = 'GET', body) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || `Vercel API failed (${response.status}).`);
    error.response = data;
    throw error;
  }

  return data;
}

function detectFramework(frontendFiles) {
  const packageJson = frontendFiles['package.json'];
  if (!packageJson) return 'vite';

  try {
    const pkg = JSON.parse(packageJson);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps.next) return 'nextjs';
    return 'vite';
  } catch {
    return 'vite';
  }
}

function toVercelFiles(frontendFiles) {
  return Object.entries(frontendFiles).map(([file, data]) => ({
    file,
    data,
  }));
}

async function ensureProject({ projectName, token, teamId }) {
  const name = String(projectName || 'genesis-app')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  const qs = queryString(teamId);

  try {
    const existing = await callVercel(`/v9/projects/${encodeURIComponent(name)}${qs}`, token);
    return { id: existing.id, name: existing.name || name };
  } catch {
    const created = await callVercel(`/v9/projects${qs}`, token, 'POST', {
      name,
      framework: 'nextjs',
    });
    return { id: created.id, name: created.name || name };
  }
}

async function upsertProjectEnv({ projectId, token, teamId, env }) {
  if (!env || typeof env !== 'object') return;

  const qs = queryString(teamId);
  const entries = Object.entries(env).filter(([, value]) => value !== undefined && value !== null);

  for (const [key, value] of entries) {
    await callVercel(`/v10/projects/${encodeURIComponent(projectId)}/env${qs}`, token, 'POST', {
      key,
      value: String(value),
      target: ['production', 'preview', 'development'],
      type: 'plain',
    });
  }
}

async function pollDeploymentReady({ deploymentId, token, teamId, logger }) {
  const qs = queryString(teamId);
  const maxChecks = 45;

  for (let i = 0; i < maxChecks; i += 1) {
    const deployment = await callVercel(`/v13/deployments/${deploymentId}${qs}`, token, 'GET');

    if (deployment.readyState === 'READY') {
      return deployment;
    }

    if (deployment.readyState === 'ERROR' || deployment.readyState === 'CANCELED') {
      const events = await callVercel(`/v2/deployments/${deploymentId}/events${qs}`, token, 'GET').catch(() => ({
        events: [],
      }));
      const buildLogs = Array.isArray(events?.events)
        ? events.events.map((event) => event?.payload?.text || event?.text).filter(Boolean).join('\n')
        : '';

      const error = new Error(deployment.errorMessage || 'Frontend deployment failed.');
      error.buildLogs = buildLogs;
      throw error;
    }

    await logger.info('Frontend deployment still in progress.', { readyState: deployment.readyState, check: i + 1 });
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  throw new Error('Frontend deployment timed out while waiting for Vercel.');
}

export async function deployFrontend({ projectName, frontendFiles, env, logger, project = null, projectId = null, subdomain = null }) {
  if (deployService.isManagedEngine()) {
    const localProject =
      project ||
      ({
        id: projectId || String(projectName || 'genesis-frontend').toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: projectName,
        files: frontendFiles,
      });

    const managed = await deployService.deployManagedProject({
      project: localProject,
      subdomain,
    });

    await logger?.info?.('Frontend deployed in managed mode.', {
      projectName,
      subdomain: managed.subdomain,
      port: managed.port,
      url: managed.url,
    });

    return {
      projectId: localProject.id,
      deploymentId: managed.deployId,
      url: managed.url,
      buildLogs: '',
      port: managed.port,
    };
  }

  const { token, teamId } = getVercelConfig();
  const vercelProject = await ensureProject({ projectName, token, teamId });

  await upsertProjectEnv({ projectId: vercelProject.id, token, teamId, env });

  const framework = detectFramework(frontendFiles);
  const files = toVercelFiles(frontendFiles);

  await logger.info('Triggering Vercel deployment.', {
    projectId: vercelProject.id,
    fileCount: files.length,
    framework,
  });

  const qs = queryString(teamId);
  const deployRes = await callVercel(`/v13/deployments${qs}`, token, 'POST', {
    name: vercelProject.name,
    project: vercelProject.id,
    target: 'production',
    files,
    projectSettings: {
      framework,
    },
  });

  const ready = await pollDeploymentReady({
    deploymentId: deployRes.id,
    token,
    teamId,
    logger,
  });

  return {
    projectId: vercelProject.id,
    deploymentId: ready.id,
    url: `https://${ready.url}`,
    buildLogs: '',
  };
}
