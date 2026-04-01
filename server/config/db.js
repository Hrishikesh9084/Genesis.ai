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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: toInt(process.env.DB_POOL_MAX, 40),
  min: toInt(process.env.DB_POOL_MIN, 5),
  idleTimeoutMillis: toInt(process.env.DB_IDLE_TIMEOUT_MS, 30000),
  connectionTimeoutMillis: toInt(process.env.DB_CONNECTION_TIMEOUT_MS, 5000),
  query_timeout: toInt(process.env.DB_QUERY_TIMEOUT_MS, 15000),
  statement_timeout: toInt(process.env.DB_STATEMENT_TIMEOUT_MS, 20000),
  keepAlive: true,
  keepAliveInitialDelayMillis: toInt(process.env.DB_KEEPALIVE_INITIAL_DELAY_MS, 10000),
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

const schemaReady = pool
  .query(
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
  )
  .catch((err) => {
    console.error('Schema migration failed:', err.message);
    throw err;
  });

const db = {
  query: async (text, params) => {
    await schemaReady;
    return pool.query(text, params);
  },
  pool,
};

export default db;
