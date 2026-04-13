import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

const PRIMARY_LOG_DIR = path.resolve(process.cwd(), 'uploads', 'deploy-logs');
const FALLBACK_LOG_DIR = path.join(os.tmpdir(), 'genesis-ai', 'uploads', 'deploy-logs');

let resolvedLogDirPromise = null;

async function resolveLogDir() {
  if (!resolvedLogDirPromise) {
    resolvedLogDirPromise = (async () => {
      const preferredDirs = [
        process.env.GENESIS_DEPLOY_LOG_DIR,
        PRIMARY_LOG_DIR,
        FALLBACK_LOG_DIR,
      ].filter(Boolean);

      let lastError = null;
      for (const candidate of preferredDirs) {
        try {
          await fs.mkdir(candidate, { recursive: true });
          return candidate;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Unable to create a writable deployment log directory.');
    })();
  }

  return resolvedLogDirPromise;
}

async function ensureLogDir() {
  return resolveLogDir();
}

function toLine(entry) {
  return `${JSON.stringify(entry)}\n`;
}

function stringifyMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
    return '';
  }

  const preferred = ['error', 'summary', 'stderr', 'stdout'];
  for (const key of preferred) {
    if (metadata[key]) {
      return String(metadata[key]);
    }
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return '';
  }
}

export function createDeploymentLogger(projectName) {
  const deploymentId = `dep_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const safeName = String(projectName || 'app')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'app';
  const inMemory = [];
  const listeners = new Set();
  let logFilePath = path.join(PRIMARY_LOG_DIR, `${safeName}-${deploymentId}.log`);

  async function write(level, message, metadata = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      message: String(message || ''),
      metadata,
    };

    inMemory.push(entry);
    for (const listener of listeners) {
      try {
        listener(entry);
      } catch {
        // Ignore listener callback errors.
      }
    }
    const logDir = await ensureLogDir();
    if (path.dirname(logFilePath) !== logDir) {
      logFilePath = path.join(logDir, `${safeName}-${deploymentId}.log`);
    }
    await fs.appendFile(logFilePath, toLine(entry), 'utf8');
  }

  return {
    deploymentId,
    get logFilePath() {
      return logFilePath;
    },
    async info(message, metadata = {}) {
      await write('info', message, metadata);
    },
    async warn(message, metadata = {}) {
      await write('warn', message, metadata);
    },
    async error(message, metadata = {}) {
      await write('error', message, metadata);
    },
    dump() {
      return inMemory
        .map((entry) => {
          const metadataText = stringifyMetadata(entry.metadata);
          if (!metadataText) {
            return `[${entry.ts}] ${entry.level.toUpperCase()} ${entry.message}`;
          }
          return `[${entry.ts}] ${entry.level.toUpperCase()} ${entry.message} | ${metadataText}`;
        })
        .join('\n');
    },
    entries() {
      return [...inMemory];
    },
    subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }

      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
