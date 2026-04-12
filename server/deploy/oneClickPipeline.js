import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDeploymentLogger } from './logger.js';
import { normalizeProjectFiles, connectServices } from './connectServices.js';
import { deployFrontend } from './deployFrontend.js';
import { deployBackend } from './deployBackend.js';
import { assignSubdomain } from './assignDomain.js';
import { fixDeploymentErrorsWithAI } from './fixErrors.js';

function sanitizeName(value, fallback = 'genesis-app') {
  const cleaned = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return cleaned || fallback;
}

async function writeFileTree(rootDir, files) {
  await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
      const abs = path.resolve(rootDir, normalized);
      if (!abs.startsWith(rootDir)) {
        throw new Error(`Invalid file path: ${filePath}`);
      }
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, String(content ?? ''), 'utf8');
    })
  );
}

async function initializeGitRepo(rootDir) {
  const gitDir = path.join(rootDir, '.git');
  try {
    await fs.access(gitDir);
    return;
  } catch {
    // No git repo detected.
  }

  const proc = await import('node:child_process');
  const execPromise = (command) =>
    new Promise((resolve, reject) => {
      proc.exec(command, { cwd: rootDir }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || stdout || err.message));
          return;
        }
        resolve(stdout);
      });
    });

  await execPromise('git init');
}

export async function runOneClickDeployment(payload, { userId } = {}) {
  const projectName = sanitizeName(payload?.projectName || payload?.name || 'genesis-app');
  const logger = createDeploymentLogger(projectName);

  const maxAttemptsFromInput = Number.parseInt(String(payload?.maxAttempts || ''), 10);
  const maxAttempts = Number.isFinite(maxAttemptsFromInput) && maxAttemptsFromInput > 0
    ? Math.min(maxAttemptsFromInput, 3)
    : 3;

  let { frontendFiles, backendFiles } = normalizeProjectFiles(payload?.code || payload);

  if (!Object.keys(frontendFiles).length || !Object.keys(backendFiles).length) {
    throw new Error('Both frontend and backend files are required for one-click deployment.');
  }

  let lastError = null;
  const attemptSummaries = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptTag = `attempt-${attempt}`;
    await logger.info('Starting deployment attempt.', { attempt, maxAttempts, userId });

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `genesis-${projectName}-${attemptTag}-`));
    const frontendRoot = path.join(tempRoot, 'frontend');
    const backendRoot = path.join(tempRoot, 'backend');

    try {
      await writeFileTree(frontendRoot, frontendFiles);
      await writeFileTree(backendRoot, backendFiles);
      await initializeGitRepo(frontendRoot).catch(() => {});
      await initializeGitRepo(backendRoot).catch(() => {});

      const backendResult = await deployBackend({
        projectName,
        backendFiles,
        env: {
          ...(payload?.env?.backend || {}),
          PORT: payload?.env?.backend?.PORT || process.env.DEFAULT_BACKEND_PORT || '3000',
        },
        logger,
      });

      const connected = connectServices({
        frontendFiles: { ...frontendFiles },
        backendFiles: { ...backendFiles },
        backendUrl: backendResult.url,
      });

      frontendFiles = connected.frontendFiles;
      backendFiles = connected.backendFiles;

      const frontendResult = await deployFrontend({
        projectName,
        frontendFiles,
        env: {
          ...(payload?.env?.frontend || {}),
          NEXT_PUBLIC_API_URL: backendResult.url,
        },
        logger,
      });

      const domainResult = await assignSubdomain({
        projectName: payload?.subdomain || projectName,
        projectId: frontendResult.projectId,
        logger,
      });

      await logger.info('Deployment completed successfully.', {
        frontendUrl: frontendResult.url,
        backendUrl: backendResult.url,
        liveUrl: domainResult.url,
      });

      return {
        ok: true,
        deploymentId: logger.deploymentId,
        projectName,
        frontendUrl: frontendResult.url,
        backendUrl: backendResult.url,
        liveUrl: domainResult.url,
        subdomain: domainResult.subdomain,
        attempts: attempt,
        logsPath: logger.logFilePath,
        attemptSummaries,
      };
    } catch (err) {
      lastError = err;
      const buildLogs = String(err?.buildLogs || '');
      const mergedLogs = `${logger.dump()}\n${buildLogs}`.trim();

      attemptSummaries.push({
        attempt,
        error: err.message,
      });

      await logger.error('Deployment attempt failed.', {
        attempt,
        error: err.message,
      });

      if (attempt < maxAttempts) {
        try {
          const fixed = await fixDeploymentErrorsWithAI({
            projectName,
            frontendFiles,
            backendFiles,
            logs: mergedLogs,
            logger,
          });

          frontendFiles = fixed.frontendFiles;
          backendFiles = fixed.backendFiles;
          await logger.warn('Retrying deployment after AI fixes.', {
            attempt: attempt + 1,
            notes: fixed.notes,
          });
        } catch (fixErr) {
          await logger.error('AI auto-fix failed.', { error: fixErr.message });
          throw err;
        }
      }
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {
        // Ignore cleanup issues.
      });
    }
  }

  throw new Error(`Deployment failed after ${maxAttempts} attempt(s): ${lastError?.message || 'Unknown error'}`);
}
