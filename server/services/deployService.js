import https from 'https';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pm2 from 'pm2';
import portManager from './portManager.js';

const DEFAULT_DEPLOY_DOMAIN = process.env.GENESIS_DEPLOY_BASE_DOMAIN || 'genesisapp.in';
const execFileAsync = promisify(execFile);
const PM2_CONNECT_ASYNC = promisify(pm2.connect.bind(pm2));
const PM2_DISCONNECT_ASYNC = promisify(pm2.disconnect.bind(pm2));
const PRIMARY_MANAGED_APPS_DIR = path.resolve(process.cwd(), 'uploads', 'managed-apps');
const FALLBACK_MANAGED_APPS_DIR = path.join(os.tmpdir(), 'genesis-ai', 'uploads', 'managed-apps');
const managedDeployments = new Map();
const MANAGED_RUNTIME = String(process.env.GENESIS_MANAGED_RUNTIME || 'pm2').toLowerCase();
let managedAppsDirPromise = null;

async function getManagedAppsDir() {
  if (!managedAppsDirPromise) {
    managedAppsDirPromise = (async () => {
      const candidates = [
        process.env.GENESIS_MANAGED_APPS_DIR,
        PRIMARY_MANAGED_APPS_DIR,
        FALLBACK_MANAGED_APPS_DIR,
      ].filter(Boolean);

      let lastError = null;
      for (const candidate of candidates) {
        try {
          await fs.mkdir(candidate, { recursive: true });
          return candidate;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Unable to create managed app workspace directory.');
    })();
  }

  return managedAppsDirPromise;
}

function isDockerManagedRuntime() {
  return MANAGED_RUNTIME === 'docker';
}

function parseProjectFiles(files) {
  if (!files) return {};
  if (typeof files === 'string') {
    return JSON.parse(files);
  }
  return files;
}

async function writeManagedProjectFiles(rootDir, files) {
  await fs.mkdir(rootDir, { recursive: true });

  await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
      const absolute = path.resolve(rootDir, normalized);

      if (!absolute.startsWith(rootDir)) {
        throw new Error(`Invalid file path outside project root: ${filePath}`);
      }

      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, String(content ?? ''), 'utf8');
    })
  );
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveRuntimeConfig(rootDir) {
  const rootPackagePath = path.join(rootDir, 'package.json');
  const serverPackagePath = path.join(rootDir, 'server', 'package.json');
  const clientPackagePath = path.join(rootDir, 'client', 'package.json');

  const hasRootPkg = await exists(rootPackagePath);
  const hasServerPkg = await exists(serverPackagePath);
  const hasClientPkg = await exists(clientPackagePath);

  let appDir = rootDir;
  let packagePath = rootPackagePath;
  const isMonorepo = hasServerPkg && hasClientPkg;

  // Monorepo: always resolve to server/ as the runtime directory.
  // This avoids installing only root-level deps (e.g. concurrently)
  // while actual backend dependencies (express, bcrypt, …) are skipped.
  if (hasServerPkg) {
    appDir = path.join(rootDir, 'server');
    packagePath = serverPackagePath;
  } else if (!hasRootPkg) {
    throw new Error('No package.json found for deployment runtime.');
  }

  const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
  const scripts = pkg.scripts || {};

  let scriptName = null;
  if (typeof scripts.start === 'string') {
    scriptName = 'start';
  } else if (typeof scripts['start:prod'] === 'string') {
    scriptName = 'start:prod';
  } else if (typeof scripts.dev === 'string') {
    scriptName = 'dev';
  }

  const hasBuildScript = typeof scripts.build === 'string';

  return {
    appDir,
    scriptName,
    hasStartScript: Boolean(scriptName),
    hasBuildScript,
    isMonorepo,
    clientDir: hasClientPkg ? path.join(rootDir, 'client') : null,
  };
}

async function installDependencies(appDir, options = {}) {
  const { includeDevDeps = false, timeoutMs = 180000 } = options;
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const hasLockfile = await exists(path.join(appDir, 'package-lock.json'));
  const omitFlag = includeDevDeps ? [] : ['--omit=dev'];

  // NOTE: --ignore-scripts is intentionally omitted because native modules
  // like better-sqlite3 and bcrypt require postinstall compilation scripts.
  const primaryArgs = hasLockfile
    ? ['ci', ...omitFlag, '--no-audit', '--no-fund', '--prefer-offline', '--no-optional']
    : ['install', ...omitFlag, '--no-audit', '--no-fund', '--prefer-offline', '--no-optional'];

  const fallbackArgs = ['install', ...omitFlag, '--no-audit', '--no-fund', '--prefer-offline', '--legacy-peer-deps', '--no-optional'];

  const runNpm = async (args) => {
    const result = await execFileAsync(npmExecutable, args, {
      cwd: appDir,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === 'win32',
      timeout: timeoutMs,
    });

    return {
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
      args,
    };
  };

  try {
    return await runNpm(primaryArgs);
  } catch (firstError) {
    try {
      const retryResult = await runNpm(fallbackArgs);
      return {
        ...retryResult,
        stderr: `${String(firstError?.stderr || '')}\n${retryResult.stderr}`.trim(),
      };
    } catch (retryError) {
      const details = [
        String(firstError?.stderr || ''),
        String(firstError?.stdout || ''),
        String(retryError?.stderr || ''),
        String(retryError?.stdout || ''),
      ]
        .filter(Boolean)
        .join('\n')
        .trim();

      const installError = new Error(`Dependency installation failed. ${retryError?.message || firstError?.message || ''}`.trim());
      installError.stdout = details;
      installError.stderr = details;
      throw installError;
    }
  }
}

async function runLocalCommand(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === 'win32',
    ...options,
  });

  return {
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function pm2Describe(name) {
  return new Promise((resolve, reject) => {
    pm2.describe(name, (err, processes) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(processes || []);
    });
  });
}

function pm2Start(options) {
  return new Promise((resolve, reject) => {
    pm2.start(options, (err, proc) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(proc);
    });
  });
}

function pm2Restart(name, env) {
  return new Promise((resolve, reject) => {
    pm2.restart(
      {
        name,
        updateEnv: true,
        env,
      },
      (err, proc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(proc);
      }
    );
  });
}

function pm2Delete(name) {
  return new Promise((resolve, reject) => {
    pm2.delete(name, (err, proc) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(proc);
    });
  });
}

async function withPm2(action) {
  await PM2_CONNECT_ASYNC();
  try {
    return await action();
  } finally {
    await PM2_DISCONNECT_ASYNC();
  }
}

async function waitForHealth({ port, retries = 6, intervalMs = 1000 }) {
  let lastError = null;
  const endpoints = ['/health', '/'];

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, { signal: controller.signal });
        clearTimeout(timeout);
        // Treat any non-5xx response as "server is up" to support apps without /health.
        if (response.ok || response.status < 500) {
          return true;
        }
        lastError = new Error(`Probe ${endpoint} returned ${response.status}`);
      } catch (err) {
        lastError = err;
      }
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Health check failed for port ${port}: ${lastError?.message || 'Unknown error'}`);
}

function isManagedEngine() {
  const value = String(process.env.GENESIS_DEPLOY_ENGINE || 'managed').toLowerCase();
  return ['managed', 'local', 'pm2'].includes(value);
}

function sanitizeChildProcessEnv(env) {
  const entries = Object.entries(env || {}).filter(([key, value]) => {
    if (!key || key.includes('=')) return false;
    return value !== undefined && value !== null;
  });

  return Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
}

async function startOrRestartManagedProcess({ projectName, pm2Name, appDir, scriptName, port, userEnvVars }) {
  const env = sanitizeChildProcessEnv({
    ...process.env,
    ...(userEnvVars || {}),
    PORT: String(port),
    HOST: '0.0.0.0',
    NODE_ENV: 'production',
  });

  await withPm2(async () => {
    const existing = await pm2Describe(pm2Name);

    if (existing.length > 0) {
      await pm2Restart(pm2Name, env);
      return;
    }

    const args = scriptName ? `run ${scriptName}` : 'index.js';
    await pm2Start({
      name: pm2Name,
      script: scriptName ? (process.platform === 'win32' ? 'npm.cmd' : 'npm') : 'node',
      args,
      cwd: appDir,
      env,
      autorestart: true,
      max_restarts: 10,
    });
  });

  return {
    projectName,
    pm2Name,
    port,
  };
}

function summarizeCommandOutput(output) {
  const text = String(output || '').trim();
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  return lines.slice(-12).join('\n');
}

function summarizeErrorOutput(error) {
  const details = [error?.message, error?.stderr, error?.stdout].filter(Boolean).join('\n');
  return summarizeCommandOutput(details);
}

async function deployManagedProject({ project, subdomain, logger, userEnvVars }) {
  if (!project?.id) {
    throw new Error('Project id is required for managed deployment.');
  }

  const safeProjectName = sanitizeProjectName(project.name || `project-${project.id}`);
  const safeSubdomain = portManager.sanitizeSubdomain(subdomain || safeProjectName);
  const mapping = await portManager.assignPortForProject({ projectName: safeProjectName, subdomain: safeSubdomain });
  const port = Number(mapping.port);
  const pm2Name = String(mapping.pm2Name || `genesis-${safeProjectName}`);

  await logger?.info?.('Allocated deployment runtime mapping.', {
    projectId: project.id,
    projectName: safeProjectName,
    subdomain: safeSubdomain,
    port,
    runtime: MANAGED_RUNTIME,
  });

  const managedAppsDir = await getManagedAppsDir();
  const projectRoot = path.join(managedAppsDir, String(project.id));
  const files = parseProjectFiles(project.files);
  if (!files || Object.keys(files).length === 0) {
    throw new Error('Project has no generated files to deploy.');
  }

  await logger?.info?.('Preparing managed deployment workspace.', {
    projectRoot,
    filesCount: Object.keys(files).length,
  });

  // Incremental cleanup: preserve node_modules in root, server/, and client/ for faster redeploys.
  // This is critical for EC2 free-tier instances (t2.micro) with limited CPU/RAM.
  const hasAnyNodeModules =
    (await exists(path.join(projectRoot, 'node_modules'))) ||
    (await exists(path.join(projectRoot, 'server', 'node_modules'))) ||
    (await exists(path.join(projectRoot, 'client', 'node_modules')));

  if (hasAnyNodeModules) {
    const preserveDirs = new Set(['node_modules', '.cache']);
    const cleanDir = async (dir) => {
      const entries = await fs.readdir(dir).catch(() => []);
      await Promise.all(
        entries
          .filter((f) => !preserveDirs.has(f))
          .map((f) => fs.rm(path.join(dir, f), { recursive: true, force: true }).catch(() => {}))
      );
    };
    await cleanDir(projectRoot);
    // Also clean server/ and client/ contents while preserving their node_modules
    for (const sub of ['server', 'client']) {
      const subDir = path.join(projectRoot, sub);
      if (await exists(subDir)) await cleanDir(subDir);
    }
  } else {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => {});
  }
  await writeManagedProjectFiles(projectRoot, files);

  await logger?.info?.('Project files written to managed workspace.', {
    projectRoot,
  });

  const runtimeConfig = await resolveRuntimeConfig(projectRoot);
  await logger?.info?.('Runtime config resolved.', {
    appDir: runtimeConfig.appDir,
    scriptName: runtimeConfig.scriptName || null,
    isMonorepo: runtimeConfig.isMonorepo,
    hasBuildScript: runtimeConfig.hasBuildScript,
  });

  const npmExec = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  let installResult;

  // Step 1: Install server/backend dependencies
  const serverInstallOpts = runtimeConfig.hasBuildScript ? { includeDevDeps: true } : {};
  await logger?.info?.('Installing server dependencies.', { cwd: runtimeConfig.appDir });
  try {
    installResult = await installDependencies(runtimeConfig.appDir, serverInstallOpts);
  } catch (installError) {
    await logger?.error?.('Server dependency installation failed.', {
      summary: summarizeErrorOutput(installError),
      error: installError?.message,
    });
    throw installError;
  }
  const serverInstallSummary = summarizeCommandOutput(`${installResult.stdout}\n${installResult.stderr}`);
  await logger?.info?.('Server dependency install finished.', { summary: serverInstallSummary });

  // Step 2: Build server if it has a build script (e.g. esbuild / tsc)
  if (runtimeConfig.hasBuildScript) {
    await logger?.info?.('Building server for production.', { cwd: runtimeConfig.appDir });
    try {
      const buildResult = await runLocalCommand(npmExec, ['run', 'build'], {
        cwd: runtimeConfig.appDir,
        timeout: 120000,
      });
      await logger?.info?.('Server build completed.', {
        summary: summarizeCommandOutput(`${buildResult.stdout}\n${buildResult.stderr}`),
      });
    } catch (buildError) {
      await logger?.error?.('Server build failed.', {
        summary: summarizeErrorOutput(buildError),
        error: buildError?.message,
      });
      throw buildError;
    }
  }

  // Step 3: For monorepo apps, install client deps and build the frontend
  // so the server can serve static files in production mode.
  if (runtimeConfig.clientDir) {
    try {
      await logger?.info?.('Installing client dependencies for frontend build.', { cwd: runtimeConfig.clientDir });
      const clientInstallResult = await installDependencies(runtimeConfig.clientDir, { includeDevDeps: true });
      await logger?.info?.('Client dependency install finished.', {
        summary: summarizeCommandOutput(`${clientInstallResult.stdout}\n${clientInstallResult.stderr}`),
      });

      const clientPkg = JSON.parse(await fs.readFile(path.join(runtimeConfig.clientDir, 'package.json'), 'utf8'));
      if (clientPkg.scripts?.build) {
        await logger?.info?.('Building client for production.', { cwd: runtimeConfig.clientDir });
        const clientBuildResult = await runLocalCommand(npmExec, ['run', 'build'], {
          cwd: runtimeConfig.clientDir,
          timeout: 180000,
        });
        await logger?.info?.('Client build completed.', {
          summary: summarizeCommandOutput(`${clientBuildResult.stdout}\n${clientBuildResult.stderr}`),
        });
      }
    } catch (clientError) {
      // Client build failure is non-fatal — the API server will still work
      await logger?.warn?.('Client build failed. API will work but frontend may not be served.', {
        error: clientError?.message,
      });
    }
  }

  let runtimeType = 'pm2';
  let runtimeId = pm2Name;

  if (isDockerManagedRuntime()) {
    const dockerImageTag = `${pm2Name}:latest`;
    const dockerfilePath = path.join(projectRoot, '.genesis.managed.Dockerfile');
    const cmd = runtimeConfig.scriptName ? `npm run ${runtimeConfig.scriptName}` : 'node index.js';

    await fs.writeFile(
      dockerfilePath,
      `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev || npm install --omit=dev\nCOPY . .\nENV NODE_ENV=production\nEXPOSE ${port}\nCMD [\"sh\",\"-lc\",${JSON.stringify(cmd)}]\n`,
      'utf8'
    );

    await logger?.info?.('Building managed Docker image.', {
      image: dockerImageTag,
      dockerfilePath,
    });

    const dockerBuildResult = await runLocalCommand('docker', ['build', '-t', dockerImageTag, '-f', dockerfilePath, '.'], {
      cwd: runtimeConfig.appDir,
    });
    await logger?.info?.('Docker image build completed.', {
      summary: summarizeCommandOutput(`${dockerBuildResult.stdout}\n${dockerBuildResult.stderr}`),
    });

    await runLocalCommand('docker', ['rm', '-f', pm2Name], { cwd: runtimeConfig.appDir }).catch(() => {});

    await logger?.info?.('Starting managed Docker container.', {
      name: pm2Name,
      port,
    });

    // Build user env var flags for Docker
    const userEnvFlags = Object.entries(userEnvVars || {}).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

    const runResult = await runLocalCommand(
      'docker',
      [
        'run',
        '-d',
        '--name',
        pm2Name,
        '--restart',
        'unless-stopped',
        '--memory',
        process.env.GENESIS_MANAGED_MEMORY_LIMIT || '768m',
        '--cpus',
        process.env.GENESIS_MANAGED_CPU_LIMIT || '1.0',
        '--pids-limit',
        process.env.GENESIS_MANAGED_PIDS_LIMIT || '256',
        '--security-opt',
        'no-new-privileges:true',
        '-e',
        `PORT=${port}`,
        '-e',
        'HOST=0.0.0.0',
        ...userEnvFlags,
        '-p',
        `${port}:${port}`,
        dockerImageTag,
      ],
      { cwd: runtimeConfig.appDir }
    );

    runtimeType = 'docker';
    runtimeId = String(runResult.stdout || '').trim() || pm2Name;
    await logger?.info?.('Managed Docker container started.', {
      runtimeId,
    });
  } else {
    await logger?.info?.('Starting or restarting managed PM2 process.', {
      pm2Name,
      port,
      scriptName: runtimeConfig.scriptName || null,
    });

    await startOrRestartManagedProcess({
      projectName: safeProjectName,
      pm2Name,
      appDir: runtimeConfig.appDir,
      scriptName: runtimeConfig.scriptName,
      port,
      userEnvVars,
    });

    await logger?.info?.('Managed PM2 process is running.', {
      runtimeId: pm2Name,
      port,
    });
  }

  await logger?.info?.('Running health checks against managed runtime.', {
    port,
  });
  await waitForHealth({ port, retries: 6, intervalMs: 1000 });
  await logger?.info?.('Managed runtime health check passed.', {
    port,
  });

  await portManager.upsertMapping({
    subdomain: safeSubdomain,
    projectName: safeProjectName,
    port,
    pm2Name,
  });

  await logger?.info?.('Wildcard route mapping updated.', {
    subdomain: safeSubdomain,
    pm2Name,
    port,
  });

  const url = buildFrontendUrl({ subdomain: safeSubdomain, port });
  managedDeployments.set(String(project.id), {
    projectId: String(project.id),
    projectName: safeProjectName,
    subdomain: safeSubdomain,
    port,
    pm2Name,
    startedAt: Date.now(),
    lastAccessAt: Date.now(),
    status: {
      status: 'running',
      startedAt: Date.now(),
      lastAccessAt: Date.now(),
      frontendUrl: `http://127.0.0.1:${port}`,
      backendUrl: `http://127.0.0.1:${port}`,
    },
    runtimeType,
    runtimeId,
    url,
  });

  return {
    subdomain: safeSubdomain,
    port,
    url,
    deployId: pm2Name,
    pm2Name,
    runtimeType,
    runtimeId,
  };
}

async function tailLines(filePath, maxLines = 200) {
  if (!filePath) return '';
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split(/\r?\n/).slice(-maxLines).join('\n');
  } catch {
    return '';
  }
}

async function getManagedDeploymentLogs({ runtimeId, runtimeType, maxLines = 200 }) {
  const type = String(runtimeType || '').toLowerCase();
  const id = String(runtimeId || '').trim();
  if (!id) return '';

  if (type === 'docker') {
    const result = await runLocalCommand('docker', ['logs', '--tail', String(maxLines), id]).catch((err) => ({
      stdout: '',
      stderr: String(err?.message || ''),
    }));

    return [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
  }

  const pm2Details = await withPm2(async () => {
    return pm2Describe(id);
  }).catch(() => []);

  const info = pm2Details?.[0]?.pm2_env || {};
  const outLogs = await tailLines(info.pm_out_log_path, maxLines);
  const errLogs = await tailLines(info.pm_err_log_path, maxLines);
  return [outLogs, errLogs].filter(Boolean).join('\n').trim();
}

async function stopManagedDeploymentByProject(projectId) {
  const current = managedDeployments.get(String(projectId));
  if (!current?.pm2Name) return false;

  if (String(current.runtimeType || 'pm2') === 'docker') {
    await runLocalCommand('docker', ['rm', '-f', current.pm2Name]).catch(() => {
      // Ignore if container is already removed.
    });
  } else {
    await withPm2(async () => {
      try {
        await pm2Delete(current.pm2Name);
      } catch {
        // Ignore if process is already removed.
      }
    });
  }

  if (current?.subdomain) {
    await portManager.removeMappingBySubdomain(current.subdomain).catch(() => {});
  }

  managedDeployments.delete(String(projectId));
  return true;
}

async function stopManagedDeploymentByRuntimeId(runtimeId, runtimeType = 'pm2') {
  const id = String(runtimeId || '').trim();
  if (!id) return false;

  if (String(runtimeType).toLowerCase() === 'docker') {
    await runLocalCommand('docker', ['rm', '-f', id]).catch(() => {});
    return true;
  }

  await withPm2(async () => {
    try {
      await pm2Delete(id);
    } catch {
      // Ignore when already stopped.
    }
  }).catch(() => {});

  return true;
}

async function reconcileManagedDeployment(project, options = {}) {
  const next = await deployManagedProject({
    project,
    subdomain: options.subdomain,
  });

  return {
    ...next,
    status: 'running',
  };
}

function listManagedDeployments() {
  return [...managedDeployments.values()];
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function resolveRenderOwnerId(apiKey, ownerIdOverride) {
  if (ownerIdOverride) {
    return ownerIdOverride;
  }

  if (process.env.RENDER_OWNER_ID) {
    return process.env.RENDER_OWNER_ID;
  }

  const ownersResponse = await httpsRequest({
    hostname: 'api.render.com',
    path: '/v1/owners',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (ownersResponse.statusCode >= 400) {
    throw new Error(`Unable to fetch Render workspaces: ${JSON.stringify(ownersResponse.data)}`);
  }

  const owners = ownersResponse.data?.owners || ownersResponse.data || [];
  const ownerId = Array.isArray(owners) ? owners[0]?.owner?.id || owners[0]?.id : owners?.id;

  if (!ownerId) {
    throw new Error(
      'Render workspace not found. Set RENDER_OWNER_ID or ensure the API key has access to at least one workspace.'
    );
  }

  return ownerId;
}

function buildFrontendUrl(options) {
  // Handle both buildFrontendUrl({ subdomain, port }) and buildFrontendUrl(subdomain) for backward compat
  const subdomain = typeof options === 'string' ? options : options?.subdomain;
  const port = (typeof options === 'object' ? options?.port : undefined) || process.env.PORT || 5000;
  const publicBase = String(process.env.GENESIS_MANAGED_PUBLIC_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (publicBase) {
    if (publicBase.includes('{subdomain}')) {
      return publicBase.replace('{subdomain}', subdomain);
    }

    try {
      const parsed = new URL(publicBase);
      return `${parsed.protocol}//${subdomain}.${parsed.host}`;
    } catch {
      return `https://${subdomain}.${publicBase.replace(/^\.+/, '')}`;
    }
  }

  const requireWildcardDns = String(process.env.GENESIS_REQUIRE_WILDCARD_DNS || 'false').toLowerCase() === 'true';
  const forceWildcardUrls = String(process.env.GENESIS_FORCE_WILDCARD_URLS || 'false').toLowerCase() === 'true';
  const isProduction = String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';

  if (forceWildcardUrls || requireWildcardDns || isProduction) {
    return `https://${subdomain}.${DEFAULT_DEPLOY_DOMAIN}`;
  }

  const localHost = String(process.env.GENESIS_LOCAL_MANAGED_HOST || 'localhost').trim();
  const localProtocol = String(process.env.GENESIS_LOCAL_MANAGED_PROTOCOL || 'http').trim();
  return `${localProtocol}://${localHost}:${port}`;
}

function getDomainProviderMetadata() {
  return {
    id: 'vercel-render-docker-cloud',
    name: 'Vercel / Render / Docker Cloud',
    baseDomain: DEFAULT_DEPLOY_DOMAIN,
    urlPattern: 'https://<project>.vercel.app or https://<service>.onrender.com or https://<domain>',
  };
}

async function registerGenesisRoute({ subdomain }) {
  return { url: buildFrontendUrl({ subdomain, port: process.env.PORT || 5000 }) };
}

async function releaseGenesisRoute() {
  return undefined;
}

const deployToVercel = async (project, credentials = {}) => {
  const token = credentials.vercelToken || process.env.VERCEL_TOKEN;
  if (!token) throw new Error('Vercel token not configured.');

  const parsedFiles = typeof project.files === 'string' ? JSON.parse(project.files) : project.files;

  const vercelFiles = Object.entries(parsedFiles).map(([filePath, content]) => ({
    file: filePath,
    data: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
  }));

  const projectName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  const deployPayload = {
    name: projectName,
    files: vercelFiles,
    projectSettings: {
      framework: 'vite',
      buildCommand: 'cd client && npm install && npm run build',
      outputDirectory: 'client/dist',
      installCommand: 'npm install',
    },
  };

  const response = await httpsRequest(
    {
      hostname: 'api.vercel.com',
      path: '/v13/deployments',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    deployPayload
  );

  if (response.statusCode >= 400) {
    throw new Error(`Vercel deployment failed: ${JSON.stringify(response.data)}`);
  }

  return {
    url: `https://${response.data.url}`,
    deployId: response.data.id,
  };
};

const deployToRender = async (project, credentials = {}) => {
  const apiKey = credentials.renderApiKey || process.env.RENDER_API_KEY;
  if (!apiKey) throw new Error('Render API key not configured.');

  if (!project.github_repo_url) {
    throw new Error('Project must be pushed to GitHub before deploying to Render.');
  }

  const projectName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  const ownerId = await resolveRenderOwnerId(apiKey, credentials.renderOwnerId);

  const servicePayload = {
    type: 'web_service',
    name: projectName,
    ownerId,
    repo: project.github_repo_url,
    autoDeploy: 'yes',
    buildCommand: 'npm install',
    startCommand: 'npm start',
    rootDir: 'server',
    envVars: [{ key: 'NODE_ENV', value: 'production' }],
    plan: 'free',
    env: 'node',
  };

  const response = await httpsRequest(
    {
      hostname: 'api.render.com',
      path: '/v1/services',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    servicePayload
  );

  if (response.statusCode >= 400) {
    throw new Error(`Render deployment failed: ${JSON.stringify(response.data)}`);
  }

  const service = response.data.service || response.data;

  return {
    url: `https://${service.slug || projectName}.onrender.com`,
    deployId: service.id,
  };
};

function sanitizeProjectName(value) {
  const normalized = String(value || 'genesis-app')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return normalized || 'genesis-app';
}

function shellEscape(value) {
  return `'${String(value ?? '').replace(/'/g, `'"'"'`)}'`;
}

function normalizeCloudProvider(provider) {
  const normalized = String(provider || 'vps').trim().toLowerCase();
  if (['aws', 'digitalocean', 'vps'].includes(normalized)) return normalized;
  return 'vps';
}

function normalizeDomainInput(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^\*\./, '')
    .replace(/^\.+/, '')
    .replace(/\/$/, '');
}

function isTransientSshError(error) {
  const details = String(error?.stderr || error?.stdout || error?.message || '').toLowerCase();
  return (
    details.includes('connection reset by peer') ||
    details.includes('broken pipe') ||
    details.includes('connection timed out') ||
    details.includes('operation timed out') ||
    details.includes('kex_exchange_identification') ||
    details.includes('ssh_exchange_identification')
  );
}

function normalizePrivateKey(rawKey) {
  let key = String(rawKey || '').trim();
  if (!key) return '';

  // Keys from env files are often wrapped in quotes and keep escaped newlines.
  const quotedWithDouble = key.startsWith('"') && key.endsWith('"');
  const quotedWithSingle = key.startsWith("'") && key.endsWith("'");
  if (quotedWithDouble || quotedWithSingle) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '');
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }

  const looksLikePrivateKey =
    key.includes('-----BEGIN') && key.includes('PRIVATE KEY-----') && key.includes('-----END');

  const looksLikePlaceholder = key.includes('...');

  if (!looksLikePrivateKey || looksLikePlaceholder) {
    throw new Error(
      'Invalid SSH private key format. Use a full OpenSSH/PEM private key (BEGIN...END) and ensure line breaks are preserved.'
    );
  }

  return `${key.trim()}\n`;
}

function buildDockerCloudScript({
  projectName,
  repoUrl,
  deployDomain,
  apiDomain,
  sslEmail,
  enableKubernetes,
}) {
  const escapedProjectName = shellEscape(projectName);
  const escapedRepo = shellEscape(repoUrl);
  const escapedDomain = shellEscape(deployDomain);
  const escapedApiDomain = shellEscape(apiDomain);
  const escapedEmail = shellEscape(sslEmail);

  return `set -euo pipefail

PROJECT_NAME=${escapedProjectName}
REPO_URL=${escapedRepo}
DEPLOY_DOMAIN=${escapedDomain}
API_DOMAIN=${escapedApiDomain}
SSL_EMAIL=${escapedEmail}
ENABLE_K8S=${enableKubernetes ? 'true' : 'false'}
REMOTE_DIR="/opt/genesis/$PROJECT_NAME"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if ! command_exists docker; then
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y docker-compose-plugin
fi

if ! command_exists git; then
  apt-get update -y
  apt-get install -y git
fi

mkdir -p "$REMOTE_DIR"

if [ ! -d "$REMOTE_DIR/.git" ]; then
  rm -rf "$REMOTE_DIR"
  git clone --depth 1 "$REPO_URL" "$REMOTE_DIR"
else
  cd "$REMOTE_DIR"
  DEFAULT_BRANCH="$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')"
  if [ -z "$DEFAULT_BRANCH" ]; then
    DEFAULT_BRANCH="main"
  fi
  git fetch origin "$DEFAULT_BRANCH" --depth 1 || true
  git checkout "$DEFAULT_BRANCH" || true
  git pull origin "$DEFAULT_BRANCH" || true
fi

cd "$REMOTE_DIR"
mkdir -p deploy/docker/nginx
mkdir -p deploy/k8s

cat > deploy/docker/Dockerfile.client <<'EOF_CLIENT_DOCKERFILE'
FROM node:20-alpine AS build
WORKDIR /app
COPY client/package*.json ./
RUN npm ci || npm install
COPY client/ .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
EOF_CLIENT_DOCKERFILE

cat > deploy/docker/Dockerfile.server <<'EOF_SERVER_DOCKERFILE'
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY server/ .
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000
CMD ["node", "index.js"]
EOF_SERVER_DOCKERFILE

if [ -f server/.env ]; then
  cp server/.env deploy/docker/backend.env
else
  : > deploy/docker/backend.env
fi

cat > deploy/docker/docker-compose.prod.yml <<EOF_DOCKER_COMPOSE
services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy:1.6
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - certs:/etc/nginx/certs:rw
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
    networks:
      - web

  acme-companion:
    image: nginxproxy/acme-companion:2.5
    restart: unless-stopped
    environment:
      - DEFAULT_EMAIL=$SSL_EMAIL
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - certs:/etc/nginx/certs:rw
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
      - acme:/etc/acme.sh
    depends_on:
      - nginx-proxy
    networks:
      - web

  frontend:
    build:
      context: ../..
      dockerfile: deploy/docker/Dockerfile.client
      args:
        NEXT_PUBLIC_API_URL: https://$API_DOMAIN
    restart: unless-stopped
    environment:
      - VIRTUAL_HOST=$DEPLOY_DOMAIN
      - LETSENCRYPT_HOST=$DEPLOY_DOMAIN
      - LETSENCRYPT_EMAIL=$SSL_EMAIL
    depends_on:
      - backend
    networks:
      - web

  backend:
    build:
      context: ../..
      dockerfile: deploy/docker/Dockerfile.server
    restart: unless-stopped
    env_file:
      - ./backend.env
    environment:
      - PORT=5000
      - VIRTUAL_HOST=$API_DOMAIN
      - LETSENCRYPT_HOST=$API_DOMAIN
      - LETSENCRYPT_EMAIL=$SSL_EMAIL
      - VIRTUAL_PORT=5000
    networks:
      - web

volumes:
  certs:
  vhost:
  html:
  acme:

networks:
  web:
    name: genesis-web
EOF_DOCKER_COMPOSE

cat > deploy/k8s/frontend-deployment.yaml <<EOF_K8S_FRONTEND
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${projectName}-frontend
  namespace: genesis
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${projectName}-frontend
  template:
    metadata:
      labels:
        app: ${projectName}-frontend
    spec:
      containers:
        - name: frontend
          image: ghcr.io/your-org/${projectName}-frontend:latest
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${projectName}-frontend-hpa
  namespace: genesis
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${projectName}-frontend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
EOF_K8S_FRONTEND

cat > deploy/k8s/backend-deployment.yaml <<EOF_K8S_BACKEND
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${projectName}-backend
  namespace: genesis
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${projectName}-backend
  template:
    metadata:
      labels:
        app: ${projectName}-backend
    spec:
      containers:
        - name: backend
          image: ghcr.io/your-org/${projectName}-backend:latest
          ports:
            - containerPort: 5000
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "700m"
              memory: "768Mi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${projectName}-backend-hpa
  namespace: genesis
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${projectName}-backend
  minReplicas: 2
  maxReplicas: 12
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
EOF_K8S_BACKEND

mkdir -p .github/workflows
cat > .github/workflows/deploy-free-cloud.yml <<'EOF_CI_CD'
name: Deploy Free Cloud Stack

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to VPS with Docker Compose
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: \${{ secrets.VPS_HOST }}
          username: \${{ secrets.VPS_USER }}
          key: \${{ secrets.VPS_SSH_PRIVATE_KEY }}
          port: \${{ secrets.VPS_SSH_PORT || '22' }}
          script: |
            set -e
            cd /opt/genesis/\${{ github.event.repository.name }}
            git pull origin main
            cd deploy/docker
            docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
EOF_CI_CD

cd deploy/docker
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

if [ "$ENABLE_K8S" = "true" ]; then
  if ! command -v k3s >/dev/null 2>&1; then
    curl -sfL https://get.k3s.io | sh -
  fi
  if ! kubectl get namespace genesis >/dev/null 2>&1; then
    kubectl create namespace genesis
  fi
  kubectl apply -f ../k8s/frontend-deployment.yaml
  kubectl apply -f ../k8s/backend-deployment.yaml
fi
`;
}

async function runSshScript({ host, port, user, privateKey, script }) {
  const keyPath = path.join(os.tmpdir(), `genesis-deploy-key-${Date.now()}`);
  await fs.writeFile(keyPath, String(privateKey || ''), { encoding: 'utf8', mode: 0o600 });

  try {
    const sshArgs = [
      '-i',
      keyPath,
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'ServerAliveInterval=20',
      '-o',
      'ServerAliveCountMax=6',
      '-o',
      'TCPKeepAlive=yes',
      '-o',
      'ConnectTimeout=20',
      '-p',
      String(port || 22),
      `${user}@${host}`,
      'bash -s',
    ];

    const result = await execFileAsync('ssh', sshArgs, {
      timeout: 20 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
      input: script,
    });

    return {
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
    };
  } finally {
    await fs.rm(keyPath, { force: true }).catch(() => {});
  }
}

const deployToDockerCloud = async (project, credentials = {}) => {
  const host = String(credentials.vpsHost || process.env.DOCKER_CLOUD_VPS_HOST || '').trim();
  const user = String(credentials.vpsUser || process.env.DOCKER_CLOUD_VPS_USER || 'root').trim();
  const credentialPrivateKeyRaw = String(credentials.vpsSshPrivateKey || '').trim();
  const envPrivateKeyRaw = String(process.env.DOCKER_CLOUD_VPS_SSH_PRIVATE_KEY || '').trim();

  let privateKey = '';
  let keySource = '';
  let keyFormatError = null;

  if (credentialPrivateKeyRaw) {
    try {
      privateKey = normalizePrivateKey(credentialPrivateKeyRaw);
      keySource = 'saved deployment settings';
    } catch (err) {
      keyFormatError = err;
    }
  }

  if (!privateKey && envPrivateKeyRaw) {
    try {
      privateKey = normalizePrivateKey(envPrivateKeyRaw);
      keySource = '.env';
      keyFormatError = null;
    } catch (err) {
      keyFormatError = keyFormatError || err;
    }
  }

  if (!privateKey && keyFormatError) {
    throw new Error(
      `${keyFormatError.message} Saved key from Settings takes precedence. Update the key in Settings or clear it so .env can be used.`
    );
  }

  const port = Number.parseInt(String(credentials.vpsPort || process.env.DOCKER_CLOUD_VPS_PORT || '22'), 10) || 22;
  const deployDomain = normalizeDomainInput(
    credentials.deployDomain ||
      process.env.DOCKER_CLOUD_DEPLOY_DOMAIN ||
      process.env.GENESIS_DEPLOY_BASE_DOMAIN ||
      DEFAULT_DEPLOY_DOMAIN
  );
  const sslEmail = String(credentials.sslEmail || process.env.DOCKER_CLOUD_SSL_EMAIL || '').trim();

  if (!host || !user || !privateKey || !deployDomain || !sslEmail) {
    throw new Error(
      'Docker cloud credentials are incomplete. Configure VPS host/user/private key, deploy domain, and SSL email in Settings.'
    );
  }

  if (!project.github_repo_url) {
    throw new Error('Project must be pushed to GitHub before deploying to Docker Cloud.');
  }

  const projectName = sanitizeProjectName(project.name);
  const apiDomain = normalizeDomainInput(credentials.deployApiDomain || `api.${deployDomain}`);

  if (!deployDomain || !/^[a-z0-9.-]+$/.test(deployDomain)) {
    throw new Error('Invalid deploy domain. Use a host like genesisapp.in (without protocol, wildcard, or leading dot).');
  }

  if (!apiDomain || !/^[a-z0-9.-]+$/.test(apiDomain)) {
    throw new Error('Invalid API domain. Use a host like api.genesisapp.in (without protocol or leading dot).');
  }
  const cloudProvider = normalizeCloudProvider(credentials.cloudProvider || process.env.DOCKER_CLOUD_PROVIDER);
  const enableKubernetes =
    credentials.enableKubernetes === true ||
    String(credentials.enableKubernetes || process.env.DOCKER_CLOUD_ENABLE_KUBERNETES || 'false').toLowerCase() === 'true';

  const script = buildDockerCloudScript({
    projectName,
    repoUrl: project.github_repo_url,
    deployDomain,
    apiDomain,
    sslEmail,
    enableKubernetes,
  });

  try {
    let sshAttempt = 1;
    const maxSshAttempts = 2;

    while (sshAttempt <= maxSshAttempts) {
      try {
        await runSshScript({ host, port, user, privateKey, script });
        break;
      } catch (sshError) {
        const shouldRetry = sshAttempt < maxSshAttempts && isTransientSshError(sshError);
        if (!shouldRetry) {
          throw sshError;
        }
        sshAttempt += 1;
      }
    }
  } catch (error) {
    const details = String(error?.stderr || error?.stdout || error?.message || 'Unknown SSH error').trim();
    const keyFormatHint =
      details.includes('error in libcrypto') || details.includes('Permission denied (publickey)')
        ? ` The SSH key may be invalid or in the wrong format. Active key source: ${keySource || 'unknown'}. Paste an OpenSSH private key (not .ppk), including BEGIN/END lines.`
        : '';
    throw new Error(`Docker cloud deployment failed: ${details}${keyFormatHint}`);
  }

  return {
    // Docker compose exposes the frontend on the configured DEPLOY_DOMAIN host.
    url: `https://${deployDomain}`,
    deployId: `${cloudProvider}-${projectName}-${Date.now()}`,
  };
};

const verifyCustomDomainWithGateway = async ({ domain, txtRecordName, verificationToken, cnameTarget }) => ({
  verified: false,
  sslReady: false,
  message: 'Custom domain verification is not available in the Vercel/Render deployment mode.',
  domain,
  txtRecordName,
  verificationToken,
  cnameTarget,
});

export default {
  isManagedEngine,
  getDomainProviderMetadata,
  buildFrontendUrl,
  registerGenesisRoute,
  releaseGenesisRoute,
  deployToVercel,
  deployToRender,
  deployToDockerCloud,
  deployManagedProject,
  reconcileManagedDeployment,
  listManagedDeployments,
  stopManagedDeploymentByProject,
  stopManagedDeploymentByRuntimeId,
  getManagedDeploymentLogs,
  verifyCustomDomainWithGateway,
};
