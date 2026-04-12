import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import deployService from '../services/deployService.js';

function sanitizeName(value, fallback = 'genesis-backend') {
  const cleaned = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return cleaned || fallback;
}

async function callRailway(pathname, token, method = 'POST', body) {
  const response = await fetch(`https://backboard.railway.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Railway API failed (${response.status}).`);
    error.response = data;
    throw error;
  }

  return data;
}

async function writeBackendToTempDir(projectName, backendFiles) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `genesis-${sanitizeName(projectName)}-backend-`));

  await Promise.all(
    Object.entries(backendFiles).map(async ([filePath, content]) => {
      const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
      const absolute = path.resolve(dir, normalized);

      if (!absolute.startsWith(dir)) {
        throw new Error(`Invalid backend file path: ${filePath}`);
      }

      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, String(content ?? ''), 'utf8');
    })
  );

  return dir;
}

function toRailwayFilesPayload(backendFiles) {
  return Object.entries(backendFiles).map(([pathName, content]) => ({
    path: String(pathName),
    content: Buffer.from(String(content ?? ''), 'utf8').toString('base64'),
    encoding: 'base64',
  }));
}

async function pollRailwayDeployment({ token, deploymentId, logger }) {
  const maxChecks = 45;

  for (let i = 0; i < maxChecks; i += 1) {
    const status = await callRailway(`/v2/deployments/${encodeURIComponent(deploymentId)}`, token, 'GET');

    if (status?.status === 'SUCCESS') {
      return status;
    }

    if (status?.status === 'FAILED' || status?.status === 'CANCELED') {
      const error = new Error(status?.error || 'Backend deployment failed on Railway.');
      error.buildLogs = String(status?.logs || '');
      throw error;
    }

    await logger.info('Backend deployment still in progress.', { status: status?.status, check: i + 1 });
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  throw new Error('Backend deployment timed out while waiting for Railway.');
}

export async function deployBackend({ projectName, backendFiles, env = {}, logger, project = null, projectId = null, subdomain = null }) {
  if (deployService.isManagedEngine()) {
    const localProject =
      project ||
      ({
        id: projectId || sanitizeName(projectName || 'genesis-backend'),
        name: projectName,
        files: backendFiles,
      });

    const managed = await deployService.deployManagedProject({
      project: localProject,
      subdomain,
    });

    await logger?.info?.('Backend deployed in managed mode.', {
      projectName,
      subdomain: managed.subdomain,
      port: managed.port,
      url: managed.url,
    });

    return {
      deploymentId: managed.deployId,
      url: managed.url,
      buildLogs: '',
      port: managed.port,
    };
  }

  const railwayToken = process.env.RAILWAY_TOKEN;
  const railwayProjectId = process.env.RAILWAY_PROJECT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;

  if (!railwayToken) {
    throw new Error('RAILWAY_TOKEN is required for backend deployment.');
  }

  if (!railwayProjectId || !environmentId) {
    throw new Error('RAILWAY_PROJECT_ID and RAILWAY_ENVIRONMENT_ID are required.');
  }

  const serviceName = sanitizeName(`${projectName}-api`);
  const tempDir = await writeBackendToTempDir(projectName, backendFiles);

  try {
    await logger.info('Uploading backend bundle to Railway.', {
      serviceName,
      fileCount: Object.keys(backendFiles).length,
      tempDir,
    });

    const createRes = await callRailway('/v2/deployments', railwayToken, 'POST', {
      projectId: railwayProjectId,
      environmentId,
      serviceName,
      variables: Object.entries(env).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {}),
      files: toRailwayFilesPayload(backendFiles),
      runtime: 'node',
      startCommand: 'npm run start',
    });

    const deploymentId = createRes?.id || createRes?.deploymentId;
    if (!deploymentId) {
      throw new Error('Railway deployment did not return a deployment id.');
    }

    const ready = await pollRailwayDeployment({ token: railwayToken, deploymentId, logger });
    const serviceUrl = ready?.url || ready?.serviceUrl;

    if (!serviceUrl) {
      throw new Error('Railway deployment succeeded but service URL was not returned.');
    }

    return {
      deploymentId,
      url: serviceUrl,
      buildLogs: '',
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Best-effort cleanup.
    });
  }
}
