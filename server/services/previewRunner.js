import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';

const PREVIEWS_DIR = path.join(__dirname, '../../previews');
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

exports.startPreview = async (projectId, files) => {
  if (activePreviews.has(projectId)) {
    const existing = activePreviews.get(projectId);
    if (existing.status === 'running') return existing;
    if (existing.status === 'starting' || existing.status === 'installing') return existing;
    await exports.stopPreview(projectId);
  }

  const projectDir = path.join(PREVIEWS_DIR, projectId);
  updateStatus(projectId, 'starting', 'Writing project files...');

  try {
    // Step 1: Write files
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
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
      await runCmd('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund'], clientDir);
    }
    if (hasServer) {
      await runCmd('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund'], serverDir);
    }

    // Overwrite vite.config to set correct port and proxy
    if (hasClient) {
      const viteConfig = `
import { defineConfig } from 'vite';
let reactPlugin;
try { reactPlugin = (await import('@vitejs/plugin-react')).default; } catch(e) {}
export default defineConfig({
  plugins: reactPlugin ? [reactPlugin()] : [],
  server: {
    port: ${frontendPort},
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:${backendPort}', changeOrigin: true },
    },
  },
});
`;
      fs.writeFileSync(path.join(clientDir, 'vite.config.js'), viteConfig);
    }

    updateStatus(projectId, 'starting', 'Starting servers...');

    // Step 3: Start backend
    let backendProc = null;
    if (hasServer) {
      const entry = ['index.js', 'server.js', 'app.js'].find(
        (f) => fs.existsSync(path.join(serverDir, f))
      ) || 'index.js';

      backendProc = spawn('node', [entry], {
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
      backendProc.stdout.on('data', (d) => console.log(`[preview:backend:${projectId}] ${d.toString().trim()}`));
      backendProc.stderr.on('data', (d) => console.log(`[preview:backend:${projectId}] ${d.toString().trim()}`));
      backendProc.on('exit', (code) => {
        console.log(`[preview:backend:${projectId}] exited with code ${code}`);
      });
    }

    // Step 4: Start frontend dev server
    let frontendProc = null;
    if (hasClient) {
      frontendProc = spawn('npx', ['vite', '--host'], {
        cwd: clientDir,
        shell: true,
        stdio: 'pipe',
      });
      frontendProc.stdout.on('data', (d) => console.log(`[preview:frontend:${projectId}] ${d.toString().trim()}`));
      frontendProc.stderr.on('data', (d) => console.log(`[preview:frontend:${projectId}] ${d.toString().trim()}`));
      frontendProc.on('exit', (code) => {
        console.log(`[preview:frontend:${projectId}] exited with code ${code}`);
      });
    }

    // Wait for frontend to be ready
    if (hasClient) {
      await waitForPort(frontendPort, 90000);
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
    console.error(`[preview:${projectId}] Failed:`, err.message);
    updateStatus(projectId, 'error', err.message);
    throw err;
  }
};

exports.stopPreview = async (projectId) => {
  const preview = activePreviews.get(projectId);
  if (!preview) return;
  killProc(preview.backendProc);
  killProc(preview.frontendProc);
  activePreviews.delete(projectId);
};

exports.getStatus = (projectId) => {
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
    exports.stopPreview(id);
  }
}
process.on('exit', cleanupAll);
process.on('SIGINT', () => { cleanupAll(); process.exit(); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(); });
