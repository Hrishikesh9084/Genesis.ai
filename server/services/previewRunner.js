import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePreviewsDir() {
  if (process.env.PREVIEWS_DIR) return process.env.PREVIEWS_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'previews');
  }
  return path.join(__dirname, '../../previews');
}

const PREVIEWS_DIR = resolvePreviewsDir();
fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
const activePreviews = new Map();
const DEFAULT_PREVIEW_MODE = 'production';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function writeFiles(dir, files) {
  const parsed = typeof files === 'string' ? JSON.parse(files) : files;
  for (const [fp, content] of Object.entries(parsed)) {
    const full = path.join(dir, fp);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
}

function runCmd(cmd, args, cwd, env, logFn) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true, stdio: 'pipe', env: { ...process.env, ...env } });
    let out = '', err = '';
    proc.stdout.on('data', (d) => {
      const line = d.toString();
      out += line;
      if (typeof logFn === 'function') logFn(line, 'stdout');
    });
    proc.stderr.on('data', (d) => {
      const line = d.toString();
      err += line;
      if (typeof logFn === 'function') logFn(line, 'stderr');
    });
    proc.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err || out))));
    proc.on('error', reject);
  });
}

function readPackageJson(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

function getScriptCommand(pkg, preferredScripts) {
  if (!pkg?.scripts) return null;
  const name = preferredScripts.find((script) => typeof pkg.scripts[script] === 'string');
  return name || null;
}

function readStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function getBuildOutputDir(clientDir) {
  const distDir = path.join(clientDir, 'dist');
  if (fs.existsSync(distDir)) return distDir;

  const buildDir = path.join(clientDir, 'build');
  if (fs.existsSync(buildDir)) return buildDir;

  return distDir;
}

async function proxyApiRequest(req, res, backendPort) {
  const targetUrl = new URL(req.originalUrl, `http://127.0.0.1:${backendPort}`);
  const method = req.method || 'GET';
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await readStream(req);
  const headers = { ...req.headers };

  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];
  delete headers['transfer-encoding'];

  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
  });

  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const responseBody = Buffer.from(await response.arrayBuffer());
  res.send(responseBody);
}

function touchPreview(projectId) {
  const preview = activePreviews.get(projectId);
  if (!preview) return;
  preview.lastAccessAt = Date.now();
  activePreviews.set(projectId, preview);
}

async function startPreviewGateway({ projectId, projectDir, clientDir, backendPort, gatewayPort, maxConcurrency = 5 }) {
  const resolvedGatewayPort = gatewayPort || await getFreePort();
  const buildDir = getBuildOutputDir(clientDir);
  const staticIndex = path.join(buildDir, 'index.html');

  if (!fs.existsSync(staticIndex)) {
    throw new Error(`Production build output not found at ${staticIndex}.`);
  }

  const app = express();

  app.use((req, res, next) => {
    const preview = activePreviews.get(projectId);
    if (preview) {
      preview.currentRequests = Number(preview.currentRequests || 0) + 1;
      activePreviews.set(projectId, preview);
    }
    touchPreview(projectId);

    if (preview && Number(preview.currentRequests || 0) > maxConcurrency) {
      preview.currentRequests = Math.max(0, Number(preview.currentRequests || 1) - 1);
      activePreviews.set(projectId, preview);
      return res.status(503).json({ error: 'Service is busy, retry shortly.' });
    }

    res.on('finish', () => {
      const current = activePreviews.get(projectId);
      if (!current) return;
      current.currentRequests = Math.max(0, Number(current.currentRequests || 1) - 1);
      activePreviews.set(projectId, current);
    });

    next();
  });

  app.use('/api', (req, res) => {
    proxyApiRequest(req, res, backendPort).catch((error) => {
      console.error('[preview:gateway] API proxy failed:', error.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Production preview backend is unavailable.' });
      }
    });
  });

  app.use(express.static(buildDir, { extensions: ['html'] }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    res.sendFile(staticIndex);
  });

  const server = await new Promise((resolve, reject) => {
    const previewServer = app.listen(resolvedGatewayPort, '127.0.0.1', () => resolve(previewServer));
    previewServer.on('error', reject);
  });

  return {
    server,
    gatewayPort: resolvedGatewayPort,
    frontendUrl: `http://127.0.0.1:${resolvedGatewayPort}`,
    buildDir,
    projectDir,
  };
}

function killProc(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
    } else {
      process.kill(-proc.pid, 'SIGTERM');
    }
  } catch (_) {}
}

function waitForPort(port, timeout = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeout) return reject(new Error('Port timeout'));
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => { sock.destroy(); setTimeout(check, 500); });
      sock.once('timeout', () => { sock.destroy(); setTimeout(check, 500); });
      sock.connect(port, '127.0.0.1');
    };
    check();
  });
}

function updateStatus(projectId, status, step, extra = {}) {
  const prev = activePreviews.get(projectId) || {};
  activePreviews.set(projectId, { ...prev, status, step, ...extra });
}

async function startDevelopmentPreview(projectId, files, projectDir, options = {}) {
  let backendProc = null;
  let frontendProc = null;

  updateStatus(projectId, 'starting', 'Writing project files...', { mode: 'development' });

  try {
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectDir, { recursive: true });
    writeFiles(projectDir, files);
    updateStatus(projectId, 'installing', 'Installing dependencies...', { mode: 'development' });

    const backendPort = await getFreePort();
    const frontendPort = await getFreePort();

    const clientDir = path.join(projectDir, 'client');
    const serverDir = path.join(projectDir, 'server');
    const hasClient = fs.existsSync(path.join(clientDir, 'package.json'));
    const hasServer = fs.existsSync(path.join(serverDir, 'package.json'));

    if (hasClient) {
      await runCmd('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps'], clientDir);
    }
    if (hasServer) {
      await runCmd('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps'], serverDir);
    }

    if (hasClient && !fs.existsSync(path.join(clientDir, 'vite.config.js'))) {
      const viteConfig = `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: ${frontendPort},
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:${backendPort}',
        changeOrigin: true,
      },
    },
  },
});
`;
      fs.writeFileSync(path.join(clientDir, 'vite.config.js'), viteConfig);
    }

    updateStatus(projectId, 'starting', 'Starting servers...', { mode: 'development' });

    let backendLogs = '';
    if (hasServer) {
      const serverPkg = readPackageJson(serverDir);
      const entry = ['index.js', 'server.js', 'app.js'].find(
        (f) => fs.existsSync(path.join(serverDir, f))
      ) || 'index.js';

      const backendCandidates = [];
      if (serverPkg?.scripts?.dev) backendCandidates.push({ command: 'npm', args: ['run', 'dev'], label: 'npm run dev' });
      if (serverPkg?.scripts?.start) backendCandidates.push({ command: 'npm', args: ['run', 'start'], label: 'npm run start' });
      if (backendCandidates.length === 0) {
        backendCandidates.push({ command: 'node', args: [entry], label: `node ${entry}` });
      }

      let lastBackendError = null;
      for (const candidate of backendCandidates) {
        backendProc = spawn(candidate.command, candidate.args, {
          cwd: serverDir,
          shell: true,
          stdio: 'pipe',
          env: {
            ...process.env,
            PORT: String(backendPort),
            NODE_ENV: 'development',
            DATABASE_URL: process.env.DATABASE_URL || '',
          },
        });

        backendProc.stdout.on('data', (d) => {
          const line = d.toString();
          backendLogs += line;
          if (backendLogs.length > 6000) backendLogs = backendLogs.slice(-6000);
          console.log(`[preview:backend:${projectId}] ${line.trim()}`);
        });
        backendProc.stderr.on('data', (d) => {
          const line = d.toString();
          backendLogs += line;
          if (backendLogs.length > 6000) backendLogs = backendLogs.slice(-6000);
          console.log(`[preview:backend:${projectId}] ${line.trim()}`);
        });
        backendProc.on('exit', (code) => {
          console.log(`[preview:backend:${projectId}] exited with code ${code}`);
          updateStatus(projectId, 'error', `Backend exited with code ${code}`, { mode: 'development', lastExitAt: Date.now() });
        });

        try {
          await waitForPort(backendPort, 45000);
          lastBackendError = null;
          break;
        } catch {
          lastBackendError = new Error(`Backend command '${candidate.label}' failed to open port ${backendPort}.`);
          killProc(backendProc);
          backendProc = null;
        }
      }

      if (lastBackendError) {
        throw new Error(`Backend failed to start. ${backendLogs.trim() || lastBackendError.message}`);
      }
    }

    let frontendLogs = '';
    if (hasClient) {
      const clientPkg = readPackageJson(clientDir);
      const clientScript = getScriptCommand(clientPkg, ['dev']);
      const frontendCommand = clientScript ? 'npm' : 'npx';
      const frontendArgs = clientScript
        ? ['run', clientScript, '--', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort']
        : ['vite', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'];

      frontendProc = spawn(frontendCommand, frontendArgs, {
        cwd: clientDir,
        shell: true,
        stdio: 'pipe',
        env: {
          ...process.env,
          VITE_API_BASE_URL: '/api',
        },
      });
      frontendProc.stdout.on('data', (d) => {
        const line = d.toString();
        frontendLogs += line;
        if (frontendLogs.length > 6000) frontendLogs = frontendLogs.slice(-6000);
        console.log(`[preview:frontend:${projectId}] ${line.trim()}`);
      });
      frontendProc.stderr.on('data', (d) => {
        const line = d.toString();
        frontendLogs += line;
        if (frontendLogs.length > 6000) frontendLogs = frontendLogs.slice(-6000);
        console.log(`[preview:frontend:${projectId}] ${line.trim()}`);
      });
      frontendProc.on('exit', (code) => {
        console.log(`[preview:frontend:${projectId}] exited with code ${code}`);
        updateStatus(projectId, 'error', `Frontend exited with code ${code}`, { mode: 'development', lastExitAt: Date.now() });
      });
    }

    if (hasClient) {
      try {
        await waitForPort(frontendPort, 90000);
      } catch {
        throw new Error(`Frontend failed to start. ${frontendLogs.trim() || 'No frontend logs.'}`);
      }
    }

    const frontendUrl = hasClient ? `http://localhost:${frontendPort}` : null;
    const backendUrl = hasServer ? `http://localhost:${backendPort}` : null;

    activePreviews.set(projectId, {
      status: 'running',
      mode: 'development',
      step: 'Live',
      backendProc,
      frontendProc,
      backendPort,
      frontendPort,
      frontendUrl,
      backendUrl,
      dir: projectDir,
      startedAt: Date.now(),
      lastAccessAt: Date.now(),
      runtimePolicy: options.runtimePolicy || null,
      currentRequests: 0,
    });

    return activePreviews.get(projectId);
  } catch (err) {
    killProc(backendProc);
    killProc(frontendProc);
    console.error(`[preview:${projectId}] Failed:`, err.message);
    updateStatus(projectId, 'error', err.message, { mode: 'development' });
    throw err;
  }
}

async function startProductionPreview(projectId, files, projectDir, options = {}) {
  let backendProc = null;
  let gatewayServer = null;
  const runtimePolicy = options.runtimePolicy || {};
  const memoryLimitMb = Number.parseInt(String(runtimePolicy.memory_limit_mb || runtimePolicy.memoryLimitMb || 512), 10);
  const cpuLimitPercent = Number.parseInt(String(runtimePolicy.cpu_limit_percent || runtimePolicy.cpuLimitPercent || 100), 10);
  const maxConcurrency = Math.max(1, Math.min(25, Math.round((Number.isFinite(cpuLimitPercent) ? cpuLimitPercent : 100) / 20)));

  updateStatus(projectId, 'starting', 'Writing project files...', { mode: 'production' });

  try {
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectDir, { recursive: true });
    writeFiles(projectDir, files);
    updateStatus(projectId, 'installing', 'Installing dependencies...', { mode: 'production' });

    const backendPort = await getFreePort();
    const clientDir = path.join(projectDir, 'client');
    const serverDir = path.join(projectDir, 'server');
    const hasClient = fs.existsSync(path.join(clientDir, 'package.json'));
    const hasServer = fs.existsSync(path.join(serverDir, 'package.json'));
    const gatewayPort = await getFreePort();
    const previewUrl = `http://127.0.0.1:${gatewayPort}`;

    if (hasClient) {
      await runCmd('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps'], clientDir);
    }
    if (hasServer) {
      await runCmd('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps'], serverDir);
    }

    if (hasClient) {
      updateStatus(projectId, 'starting', 'Building production bundle...', { mode: 'production' });
      await runCmd('npm', ['run', 'build'], clientDir, {
        VITE_API_BASE_URL: '/api',
        NODE_ENV: 'production',
      });
    }

    let backendLogs = '';
    if (hasServer) {
      const serverPkg = readPackageJson(serverDir);
      const entry = ['index.js', 'server.js', 'app.js'].find(
        (f) => fs.existsSync(path.join(serverDir, f))
      ) || 'index.js';

      const buildScript = getScriptCommand(serverPkg, ['build']);
      if (buildScript) {
        await runCmd('npm', ['run', buildScript], serverDir, {
          NODE_ENV: 'production',
          PORT: String(backendPort),
          CLIENT_URL: previewUrl,
          API_URL: previewUrl,
        });
      }

      const backendCandidates = [];
      if (serverPkg?.scripts?.start) backendCandidates.push({ command: 'npm', args: ['run', 'start'], label: 'npm run start' });
      if (backendCandidates.length === 0) {
        backendCandidates.push({ command: 'node', args: [entry], label: `node ${entry}` });
      }

      let lastBackendError = null;
      for (const candidate of backendCandidates) {
        backendProc = spawn(candidate.command, candidate.args, {
          cwd: serverDir,
          shell: true,
          stdio: 'pipe',
          env: {
            ...process.env,
            PORT: String(backendPort),
            NODE_ENV: 'production',
            NODE_OPTIONS: `${String(process.env.NODE_OPTIONS || '').trim()} --max-old-space-size=${Number.isFinite(memoryLimitMb) ? memoryLimitMb : 512}`.trim(),
            CLIENT_URL: previewUrl,
            API_URL: previewUrl,
            DATABASE_URL: process.env.DATABASE_URL || '',
          },
        });

        backendProc.stdout.on('data', (d) => {
          const line = d.toString();
          backendLogs += line;
          if (backendLogs.length > 6000) backendLogs = backendLogs.slice(-6000);
          console.log(`[preview:backend:${projectId}] ${line.trim()}`);
        });
        backendProc.stderr.on('data', (d) => {
          const line = d.toString();
          backendLogs += line;
          if (backendLogs.length > 6000) backendLogs = backendLogs.slice(-6000);
          console.log(`[preview:backend:${projectId}] ${line.trim()}`);
        });
        backendProc.on('exit', (code) => {
          console.log(`[preview:backend:${projectId}] exited with code ${code}`);
          updateStatus(projectId, 'error', `Backend exited with code ${code}`, { mode: 'production', lastExitAt: Date.now() });
        });

        try {
          await waitForPort(backendPort, 45000);
          lastBackendError = null;
          break;
        } catch {
          lastBackendError = new Error(`Backend command '${candidate.label}' failed to open port ${backendPort}.`);
          killProc(backendProc);
          backendProc = null;
        }
      }

      if (lastBackendError) {
        throw new Error(`Backend failed to start. ${backendLogs.trim() || lastBackendError.message}`);
      }
    }

    const clientBuildDir = hasClient ? getBuildOutputDir(clientDir) : null;
    updateStatus(projectId, 'starting', 'Starting preview gateway...', { mode: 'production' });
    gatewayServer = await startPreviewGateway({
      projectId,
      projectDir,
      clientDir,
      backendPort,
      gatewayPort,
      maxConcurrency,
    });

    activePreviews.set(projectId, {
      status: 'running',
      mode: 'production',
      step: 'Live',
      backendProc,
      gatewayServer: gatewayServer.server,
      backendPort,
      previewPort: gatewayServer.gatewayPort,
      frontendPort: gatewayServer.gatewayPort,
      frontendUrl: gatewayServer.frontendUrl,
      backendUrl: hasServer ? `http://localhost:${backendPort}` : null,
      buildDir: clientBuildDir,
      dir: projectDir,
      startedAt: Date.now(),
      lastAccessAt: Date.now(),
      runtimePolicy,
      currentRequests: 0,
    });

    return activePreviews.get(projectId);
  } catch (err) {
    killProc(backendProc);
    if (gatewayServer?.server) {
      gatewayServer.server.close?.();
    }
    console.error(`[preview:${projectId}] Failed:`, err.message);
    updateStatus(projectId, 'error', err.message, { mode: 'production' });
    throw err;
  }
}

const startPreview = async (projectId, files, options = {}) => {
  const mode = options.mode === 'development' ? 'development' : DEFAULT_PREVIEW_MODE;
  if (activePreviews.has(projectId)) {
    const existing = activePreviews.get(projectId);
    if (existing.status === 'running' && existing.mode === mode) return existing;
    if ((existing.status === 'starting' || existing.status === 'installing') && existing.mode === mode) return existing;
    await stopPreview(projectId);
  }

  const projectDir = path.join(PREVIEWS_DIR, projectId);
  return mode === 'development'
    ? startDevelopmentPreview(projectId, files, projectDir, options)
    : startProductionPreview(projectId, files, projectDir, options);
};

const stopPreview = async (projectId) => {
  const preview = activePreviews.get(projectId);
  if (!preview) return;
  killProc(preview.backendProc);
  killProc(preview.frontendProc);
  if (preview.gatewayServer) {
    preview.gatewayServer.close?.();
  }
  activePreviews.delete(projectId);
};

const getStatus = (projectId) => {
  const preview = activePreviews.get(projectId);
  if (!preview) return { status: 'stopped', step: '' };
  return {
    status: preview.status,
    step: preview.step,
    mode: preview.mode || DEFAULT_PREVIEW_MODE,
    frontendUrl: preview.frontendUrl || null,
    backendUrl: preview.backendUrl || null,
    startedAt: preview.startedAt || null,
    lastAccessAt: preview.lastAccessAt || null,
    currentRequests: Number(preview.currentRequests || 0),
  };
};

const listActivePreviews = () => {
  return Array.from(activePreviews.entries()).map(([projectId, preview]) => ({
    projectId,
    status: preview.status,
    step: preview.step,
    mode: preview.mode || DEFAULT_PREVIEW_MODE,
    frontendUrl: preview.frontendUrl || null,
    backendUrl: preview.backendUrl || null,
    startedAt: preview.startedAt || null,
    lastAccessAt: preview.lastAccessAt || null,
    currentRequests: Number(preview.currentRequests || 0),
    runtimePolicy: preview.runtimePolicy || null,
  }));
};

// Clean up all previews on process exit
function cleanupAll() {
  for (const [id] of activePreviews) {
    stopPreview(id);
  }
}
process.on('exit', cleanupAll);
process.on('SIGINT', () => { cleanupAll(); process.exit(); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(); });

export default {
  startPreview,
  stopPreview,
  getStatus,
  touchPreview,
  listActivePreviews,
};
