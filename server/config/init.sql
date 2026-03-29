CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  github_id VARCHAR(100) UNIQUE,
  github_token TEXT,
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
  deploy_platform VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE IF EXISTS projects
ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'gemini-2.5-flash';

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

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
