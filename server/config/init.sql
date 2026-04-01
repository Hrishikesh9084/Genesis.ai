CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  github_id VARCHAR(100) UNIQUE,
  github_token TEXT,
  vercel_token TEXT,
  render_api_key TEXT,
  render_owner_id TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  email_verification_status VARCHAR(10) NOT NULL DEFAULT 'false',
  email_verification_error TEXT,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS email_verification_status VARCHAR(10) NOT NULL DEFAULT 'false';

ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS email_verification_error TEXT;

ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS vercel_token TEXT;

ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS render_api_key TEXT;

ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS render_owner_id TEXT;

ALTER TABLE IF EXISTS users
ALTER COLUMN credits SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  stack VARCHAR(100) DEFAULT 'react-express',
  model VARCHAR(100) DEFAULT 'gemini-2.5-flash',
  status VARCHAR(50) DEFAULT 'generating',
  files JSONB DEFAULT '{}',
  github_repo_url TEXT,
  deploy_url TEXT,
  deploy_frontend_url TEXT,
  deploy_backend_url TEXT,
  deploy_platform VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE IF EXISTS projects
ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'gemini-2.5-flash';

ALTER TABLE IF EXISTS projects
ADD COLUMN IF NOT EXISTS deploy_frontend_url TEXT;

ALTER TABLE IF EXISTS projects
ADD COLUMN IF NOT EXISTS deploy_backend_url TEXT;

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  url TEXT,
  deploy_id TEXT,
  logs TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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
  resume_file_path TEXT,
  resume_original_name TEXT,
  resume_mime_type VARCHAR(150),
  resume_size INTEGER,
  cover_letter TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  source VARCHAR(50) NOT NULL DEFAULT 'website',
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_roles (
  id VARCHAR(120) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(120) NOT NULL,
  location VARCHAR(255) NOT NULL,
  type VARCHAR(80) NOT NULL,
  summary TEXT NOT NULL,
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  subscribed_at TIMESTAMP DEFAULT NOW(),
  last_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_email ON job_applications(email);
CREATE INDEX IF NOT EXISTS idx_job_applications_role_id ON job_applications(role_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_roles_is_active ON job_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_status ON credit_transactions(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active);

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

CREATE INDEX IF NOT EXISTS idx_newsletter_issues_status ON newsletter_issues(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_issues_scheduled ON newsletter_issues(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_newsletter_articles_issue ON newsletter_articles(issue_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_articles_order ON newsletter_articles(order_index);
