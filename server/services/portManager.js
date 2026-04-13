import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';

const PRIMARY_STORE_DIR = path.resolve(process.cwd(), 'uploads', 'deployments');
const FALLBACK_STORE_DIR = path.join(os.tmpdir(), 'genesis-ai', 'uploads', 'deployments');
const STORE_PATH = path.join(PRIMARY_STORE_DIR, 'subdomain-port-map.json');
const DEFAULT_START_PORT = Number.parseInt(String(process.env.GENESIS_DEPLOY_START_PORT || '3001'), 10);
const DEFAULT_END_PORT = Number.parseInt(String(process.env.GENESIS_DEPLOY_END_PORT || '3999'), 10);
let storePathsPromise = null;

async function resolveStorePaths() {
  if (!storePathsPromise) {
    storePathsPromise = (async () => {
      const candidates = [
        process.env.GENESIS_DEPLOY_STORE_DIR,
        PRIMARY_STORE_DIR,
        FALLBACK_STORE_DIR,
      ].filter(Boolean);

      let lastError = null;
      for (const dir of candidates) {
        try {
          await fs.mkdir(dir, { recursive: true });
          return {
            dir,
            file: path.join(dir, 'subdomain-port-map.json'),
          };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Unable to create deployment store directory.');
    })();
  }

  return storePathsPromise;
}

function sanitizeSubdomain(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

async function ensureStore() {
  const { file } = await resolveStorePaths();
  try {
    await fs.access(file);
  } catch {
    const initial = {
      updatedAt: new Date().toISOString(),
      mappings: {},
    };
    await fs.writeFile(file, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  const { file } = await resolveStorePaths();
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  return {
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    mappings: parsed.mappings || {},
  };
}

async function writeStore(store) {
  const { file } = await resolveStorePaths();
  const payload = {
    updatedAt: new Date().toISOString(),
    mappings: store.mappings || {},
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once('error', () => {
      resolve(true);
    });

    tester.once('listening', () => {
      tester.close(() => resolve(false));
    });

    tester.listen(port, '0.0.0.0');
  });
}

async function listMappings() {
  const store = await readStore();
  return Object.entries(store.mappings).map(([subdomain, value]) => ({
    subdomain,
    ...value,
  }));
}

async function getMappingBySubdomain(subdomain) {
  const key = sanitizeSubdomain(subdomain);
  if (!key) return null;

  const store = await readStore();
  const value = store.mappings[key];
  if (!value) return null;

  return {
    subdomain: key,
    ...value,
  };
}

async function getMappingByProject(projectName) {
  const normalized = String(projectName || '').toLowerCase().trim();
  if (!normalized) return null;

  const all = await listMappings();
  return all.find((mapping) => String(mapping.projectName || '').toLowerCase() === normalized) || null;
}

async function upsertMapping({ subdomain, projectName, port, pm2Name }) {
  const key = sanitizeSubdomain(subdomain);
  if (!key) {
    throw new Error('A valid subdomain is required for deployment mapping.');
  }

  const parsedPort = Number.parseInt(String(port), 10);
  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    throw new Error('A valid port is required for deployment mapping.');
  }

  const store = await readStore();
  store.mappings[key] = {
    projectName: String(projectName || key),
    port: parsedPort,
    pm2Name: String(pm2Name || key),
    updatedAt: new Date().toISOString(),
  };

  await writeStore(store);
  return { subdomain: key, ...store.mappings[key] };
}

async function removeMappingBySubdomain(subdomain) {
  const key = sanitizeSubdomain(subdomain);
  if (!key) return false;

  const store = await readStore();
  if (!store.mappings[key]) return false;

  delete store.mappings[key];
  await writeStore(store);
  return true;
}

async function getNextAvailablePort({
  startPort = DEFAULT_START_PORT,
  endPort = DEFAULT_END_PORT,
  reservedPorts = [],
} = {}) {
  const safeStart = Number.isFinite(startPort) ? startPort : DEFAULT_START_PORT;
  const safeEnd = Number.isFinite(endPort) ? endPort : DEFAULT_END_PORT;
  const reserved = new Set(reservedPorts.map((item) => Number.parseInt(String(item), 10)).filter(Number.isFinite));

  for (let port = safeStart; port <= safeEnd; port += 1) {
    if (reserved.has(port)) continue;

    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
  }

  throw new Error(`No available ports found in range ${safeStart}-${safeEnd}.`);
}

async function assignPortForProject({ projectName, subdomain }) {
  const existingForSubdomain = await getMappingBySubdomain(subdomain);
  if (existingForSubdomain?.port) {
    return existingForSubdomain;
  }

  const existingForProject = await getMappingByProject(projectName);
  if (existingForProject?.port) {
    return upsertMapping({
      subdomain,
      projectName,
      port: existingForProject.port,
      pm2Name: existingForProject.pm2Name,
    });
  }

  const mappings = await listMappings();
  const reserved = mappings.map((mapping) => Number.parseInt(String(mapping.port), 10));
  const port = await getNextAvailablePort({ reservedPorts: reserved });

  return upsertMapping({
    subdomain,
    projectName,
    port,
    pm2Name: `genesis-${sanitizeSubdomain(projectName || subdomain)}`,
  });
}

export default {
  STORE_PATH,
  sanitizeSubdomain,
  listMappings,
  getMappingBySubdomain,
  getMappingByProject,
  upsertMapping,
  removeMappingBySubdomain,
  getNextAvailablePort,
  assignPortForProject,
};
