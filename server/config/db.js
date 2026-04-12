import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEnvConnectionString(value) {
  const raw = String(value || '').trim();
  return raw || null;
}

function deriveNeonDirectUrl(connectionString) {
  try {
    const parsed = new URL(String(connectionString));

    if (!parsed.hostname.includes('-pooler.')) {
      return null;
    }

    parsed.hostname = parsed.hostname.replace('-pooler.', '.');
    return parsed.toString();
  } catch {
    return null;
  }
}

function maskConnectionString(value) {
  try {
    const parsed = new URL(String(value));
    if (parsed.password) {
      parsed.password = '***';
    }
    if (parsed.username) {
      parsed.username = `${parsed.username.slice(0, 2)}***`;
    }
    return parsed.toString();
  } catch {
    return '[invalid-connection-string]';
  }
}

function getConnectionStringCandidates() {
  const values = [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_FALLBACK,
    process.env.DB_DIRECT_URL,
    process.env.DIRECT_DATABASE_URL,
  ]
    .map((value) => normalizeEnvConnectionString(value))
    .filter(Boolean);

  const derivedValues = values.map((value) => deriveNeonDirectUrl(value)).filter(Boolean);

  return [...new Set([...derivedValues, ...values])];
}

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY ||
      process.env.GOOGLE_CLOUD_FUNCTIONS ||
      process.env.FUNCTIONS_WORKER_RUNTIME
  );
}

function isTransientDbError(err) {
  const message = String(err?.message || '').toLowerCase();
  const stack = String(err?.stack || '').toLowerCase();
  const details = String(err || '').toLowerCase();
  const code = String(err?.code || err?.errno || '').toLowerCase();

  if (['57p01', '57p02', '57p03', '08000', '08003', '08006', '53300'].includes(code)) {
    return true;
  }

  return (
    message.includes('connection terminated') ||
    message.includes('connection refused') ||
    message.includes('connection timeout') ||
    message.includes('timeout') ||
    message.includes('connection reset') ||
    message.includes('econnreset') ||
    message.includes('ecancelled') ||
    message.includes('enotfound') ||
    message.includes('getaddrinfo') ||
    message.includes('dns') ||
    message.includes('socket hang up') ||
    message.includes('server closed the connection unexpectedly') ||
    message.includes('terminat') ||
    stack.includes('connection terminated unexpectedly') ||
    details.includes('connection terminated unexpectedly')
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPoolEnded(poolInstance) {
  return Boolean(poolInstance?.ended || poolInstance?._ended);
}

function getPoolRegistry() {
  if (!globalThis.__genesisPgPoolRegistry) {
    globalThis.__genesisPgPoolRegistry = new Map();
  }

  return globalThis.__genesisPgPoolRegistry;
}

function createTrackedPool(connectionString) {
  const trackedPool = new Pool({ ...poolConfig, connectionString });

  trackedPool.on('error', (err) => {
    const registry = getPoolRegistry();
    const transient = isTransientDbError(err);
    const label = transient ? 'Transient database error' : 'Unexpected database error';
    const safeConnectionString = maskConnectionString(connectionString);

    if (transient) {
      console.warn(`${label} (${safeConnectionString}): ${String(err?.message || 'Unknown error')}`);
    } else {
      console.error(`${label} (${safeConnectionString}):`, err);
    }

    if (registry.get(connectionString) === trackedPool && (transient || isPoolEnded(trackedPool))) {
      registry.delete(connectionString);
      trackedPool
        .end()
        .catch(() => {
          // Ignore shutdown errors for broken pools.
        });
    }
  });

  return trackedPool;
}

function getTrackedPool(connectionString) {
  const registry = getPoolRegistry();
  const existingPool = registry.get(connectionString);

  if (existingPool && !isPoolEnded(existingPool)) {
    return existingPool;
  }

  const nextPool = createTrackedPool(connectionString);
  registry.set(connectionString, nextPool);
  return nextPool;
}

async function invalidateTrackedPool(connectionString, poolInstance) {
  const registry = getPoolRegistry();

  if (registry.get(connectionString) !== poolInstance) {
    return;
  }

  registry.delete(connectionString);

  try {
    await poolInstance.end();
  } catch {
    // The pool is already broken or shutting down; a fresh pool will be created on retry.
  }
}

async function connectWithRetry() {
  const maxAttempts = Math.max(4, connectionStringCandidates.length * 3);
  const preferDirectConnections = connectionStringCandidates.some((url) => url?.includes('pooler.neon'));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let currentConnectionString;

    if (preferDirectConnections && attempt === 1) {
      const directUrl = connectionStringCandidates.find((url) => !url?.includes('pooler.neon'));
      if (directUrl) {
        currentConnectionString = directUrl;
      } else {
        currentConnectionString = connectionStringCandidates[0];
      }
    } else {
      currentConnectionString = connectionStringCandidates[(attempt - 1) % connectionStringCandidates.length];
    }

    const currentPool = getTrackedPool(currentConnectionString);

    try {
      await schemaReady;
      return await currentPool.connect();
    } catch (err) {
      if (attempt < maxAttempts && isTransientDbError(err)) {
        await invalidateTrackedPool(currentConnectionString, currentPool);
        await sleep(250 * attempt);
        continue;
      }

      throw err;
    }
  }

  throw new Error('Database connection failed after retries.');
}

async function closeTrackedPools() {
  const registry = getPoolRegistry();
  const pools = [...registry.values()];
  registry.clear();

  await Promise.all(
    pools.map(async (instance) => {
      try {
        await instance.end();
      } catch {
        // Ignore failures while shutting down broken/stale pools.
      }
    })
  );
}

const serverlessRuntime = isServerlessRuntime();
const connectionStringCandidates = getConnectionStringCandidates();

if (connectionStringCandidates.length === 0) {
  throw new Error(
    'Database configuration missing. Set DATABASE_URL (and optionally DATABASE_URL_FALLBACK/DB_DIRECT_URL).'
  );
}

const isNeonPooler = connectionStringCandidates[0]?.includes('pooler.neon');

const poolConfig = {
  connectionString: connectionStringCandidates[0],
  max: toInt(process.env.DB_POOL_MAX, isNeonPooler ? 3 : serverlessRuntime ? 1 : 40),
  min: toInt(process.env.DB_POOL_MIN, isNeonPooler ? 0 : serverlessRuntime ? 0 : 5),
  idleTimeoutMillis: toInt(
    process.env.DB_IDLE_TIMEOUT_MS,
    isNeonPooler ? 8000 : serverlessRuntime ? 10000 : 30000
  ),
  connectionTimeoutMillis: toInt(process.env.DB_CONNECTION_TIMEOUT_MS, serverlessRuntime ? 15000 : 10000),
  query_timeout: toInt(process.env.DB_QUERY_TIMEOUT_MS, serverlessRuntime ? 30000 : 20000),
  statement_timeout: toInt(process.env.DB_STATEMENT_TIMEOUT_MS, serverlessRuntime ? 45000 : 30000),
  maxUses: toInt(process.env.DB_POOL_MAX_USES, isNeonPooler ? 500 : 7500),
  keepAlive: true,
  keepAliveInitialDelayMillis: toInt(process.env.DB_KEEPALIVE_INITIAL_DELAY_MS, isNeonPooler ? 3000 : 10000),
};

if (String(process.env.DB_SSL || '').toLowerCase() === 'true') {
  poolConfig.ssl = {
    rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true',
  };
}

// Reuse one pool per runtime to avoid opening duplicate pools during hot reloads and warm serverless invocations.
const globalPoolKey = '__genesisPgPool';
const pool = globalThis[globalPoolKey] || getTrackedPool(connectionStringCandidates[0]);

globalThis[globalPoolKey] = pool;

const schemaReady = serverlessRuntime
  ? Promise.resolve()
  : (async () => {
      try {
        await pool.query(
          `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

     ALTER TABLE IF EXISTS projects
     ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'gemini-2.5-flash';

     ALTER TABLE IF EXISTS users
     ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

    ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE IF EXISTS users
    ALTER COLUMN credits SET DEFAULT 0;

     CREATE TABLE IF NOT EXISTS job_applications (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       role_id VARCHAR(120) NOT NULL,
       role_title VARCHAR(255) NOT NULL,
       full_name VARCHAR(255) NOT NULL,
       email VARCHAR(255) NOT NULL,
       phone VARCHAR(50),
       location VARCHAR(255),
       years_experience INTEGER,
       linkedin_url TEXT,
       portfolio_url TEXT,
       resume_url TEXT,
       cover_letter TEXT NOT NULL,
       status VARCHAR(50) NOT NULL DEFAULT 'new',
       source VARCHAR(50) NOT NULL DEFAULT 'website',
       meta JSONB NOT NULL DEFAULT '{}',
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
     );

     ALTER TABLE IF EXISTS job_applications
     ADD COLUMN IF NOT EXISTS role_title VARCHAR(255) NOT NULL DEFAULT 'General Application';

     ALTER TABLE IF EXISTS job_applications
     ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'new';

     ALTER TABLE IF EXISTS job_applications
     ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'website';

     ALTER TABLE IF EXISTS job_applications
     ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';

    ALTER TABLE IF EXISTS job_applications
    ADD COLUMN IF NOT EXISTS resume_file_path TEXT;

    ALTER TABLE IF EXISTS job_applications
    ADD COLUMN IF NOT EXISTS resume_original_name TEXT;

    ALTER TABLE IF EXISTS job_applications
    ADD COLUMN IF NOT EXISTS resume_mime_type VARCHAR(150);

    ALTER TABLE IF EXISTS job_applications
    ADD COLUMN IF NOT EXISTS resume_size INTEGER;

     CREATE INDEX IF NOT EXISTS idx_job_applications_email ON job_applications(email);
     CREATE INDEX IF NOT EXISTS idx_job_applications_role_id ON job_applications(role_id);
     CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
     CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at DESC);

     CREATE TABLE IF NOT EXISTS credit_transactions (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID REFERENCES users(id) ON DELETE CASCADE,
       plan_id VARCHAR(60) NOT NULL,
       credits INTEGER NOT NULL,
       amount_paise INTEGER NOT NULL,
       currency VARCHAR(10) NOT NULL DEFAULT 'INR',
       razorpay_order_id VARCHAR(120) UNIQUE,
       razorpay_payment_id VARCHAR(120),
       razorpay_signature VARCHAR(255),
       status VARCHAR(30) NOT NULL DEFAULT 'created',
       metadata JSONB NOT NULL DEFAULT '{}',
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
     );

     CREATE INDEX IF NOT EXISTS idx_credit_tx_user_id ON credit_transactions(user_id);
     CREATE INDEX IF NOT EXISTS idx_credit_tx_status ON credit_transactions(status);

     CREATE TABLE IF NOT EXISTS newsletter_subscribers (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       email VARCHAR(255) UNIQUE NOT NULL,
       is_active BOOLEAN NOT NULL DEFAULT TRUE,
       subscribed_at TIMESTAMP DEFAULT NOW(),
       last_sent_at TIMESTAMP,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
     );

     CREATE TABLE IF NOT EXISTS newsletter_issues (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       title VARCHAR(255) NOT NULL,
       subject VARCHAR(255),
       status VARCHAR(50) DEFAULT 'draft',
       scheduled_at TIMESTAMP,
       sent_at TIMESTAMP,
       subscriber_count INTEGER DEFAULT 0,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
     );

     CREATE TABLE IF NOT EXISTS newsletter_articles (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       issue_id UUID REFERENCES newsletter_issues(id) ON DELETE CASCADE,
       title VARCHAR(255) NOT NULL,
       description TEXT,
       content TEXT,
       category VARCHAR(100),
       link TEXT,
       order_index INTEGER DEFAULT 0,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
     );

      CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active);
      CREATE INDEX IF NOT EXISTS idx_newsletter_issues_status ON newsletter_issues(status);
      CREATE INDEX IF NOT EXISTS idx_newsletter_issues_scheduled ON newsletter_issues(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_newsletter_articles_issue ON newsletter_articles(issue_id);
       CREATE INDEX IF NOT EXISTS idx_newsletter_articles_order ON newsletter_articles(order_index);`
        );
      } catch (err) {
        console.error('Schema migration failed:', err.message);
      }
    })();

  async function queryWithRetry(text, params) {
    const maxAttempts = Math.max(4, connectionStringCandidates.length * 3);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const currentConnectionString = connectionStringCandidates[(attempt - 1) % connectionStringCandidates.length];
      const currentPool = getTrackedPool(currentConnectionString);
      try {
        await schemaReady;
        return await currentPool.query(text, params);
      } catch (err) {
        if (attempt < maxAttempts && isTransientDbError(err)) {
          await invalidateTrackedPool(currentConnectionString, currentPool);
          await sleep(250 * attempt);
          continue;
        }

        throw err;
      }
    }

    throw new Error('Database query failed after retries.');
  }

const db = {
  query: async (text, params) => {
      return queryWithRetry(text, params);
  },
  connect: async () => {
    return connectWithRetry();
  },
  close: async () => {
    await closeTrackedPools();
  },
  pool,
};

export default db;
