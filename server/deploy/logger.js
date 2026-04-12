import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const LOG_DIR = path.resolve(process.cwd(), 'uploads', 'deploy-logs');

async function ensureLogDir() {
  await fs.mkdir(LOG_DIR, { recursive: true });
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

  const logFilePath = path.join(LOG_DIR, `${safeName}-${deploymentId}.log`);
  const inMemory = [];
  const listeners = new Set();

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
    await ensureLogDir();
    await fs.appendFile(logFilePath, toLine(entry), 'utf8');
  }

  return {
    deploymentId,
    logFilePath,
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
