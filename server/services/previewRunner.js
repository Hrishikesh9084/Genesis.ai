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

function runCmd(cmd, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true, stdio: 'pipe', env: { ...process.env, ...env } });
    let out = '', err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
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

const startPreview = async (projectId, files) => {
  if (activePreviews.has(projectId)) {
    const existing = activePreviews.get(projectId);
    if (existing.status === 'running') return existing;
    if (existing.status === 'starting' || existing.status === 'installing') return existing;
    await stopPreview(projectId);
  }

  const projectDir = path.join(PREVIEWS_DIR, projectId);
  let backendProc = null;
  let frontendProc = null;
  updateStatus(projectId, 'starting', 'Writing project files...');

  try {
    // Step 1: Write files
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectDir, { recursive: true });
    writeFiles(projectDir, files);
    updateStatus(projectId, 'installing', 'Installing dependencies...');

    // Get ports
    const backendPort = await getFreePort();
    const frontendPort = await getFreePort();

    const clientDir = path.join(projectDir, 'client');
    const serverDir = path.join(projectDir, 'server');
    const hasClient = fs.existsSync(path.join(clientDir, 'package.json'));
    const hasServer = fs.existsSync(path.join(serverDir, 'package.json'));

    // Step 2: Install dependencies
    if (hasClient) {
      await runCmd('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps'], clientDir);
    }
    if (hasServer) {
      await runCmd('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps'], serverDir);
    }

    // Ensure preview proxy works even when generated client has no vite config.
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

    updateStatus(projectId, 'starting', 'Starting servers...');

    // Step 3: Start backend
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

    // Step 4: Start frontend dev server
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
      });
    }

    // Wait for frontend to be ready
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
      step: 'Live',
      backendProc,
      frontendProc,
      backendPort,
      frontendPort,
      frontendUrl,
      backendUrl,
      dir: projectDir,
      startedAt: Date.now(),
    });

    return activePreviews.get(projectId);
  } catch (err) {
    killProc(backendProc);
    killProc(frontendProc);
    console.error(`[preview:${projectId}] Failed:`, err.message);
    updateStatus(projectId, 'error', err.message);
    throw err;
  }
};

const stopPreview = async (projectId) => {
  const preview = activePreviews.get(projectId);
  if (!preview) return;
  killProc(preview.backendProc);
  killProc(preview.frontendProc);
  activePreviews.delete(projectId);
};

const getStatus = (projectId) => {
  const preview = activePreviews.get(projectId);
  if (!preview) return { status: 'stopped', step: '' };
  return {
    status: preview.status,
    step: preview.step,
    frontendUrl: preview.frontendUrl || null,
    backendUrl: preview.backendUrl || null,
  };
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
};
