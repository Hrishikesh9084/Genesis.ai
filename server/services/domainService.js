import db from '../config/db.js';
import deployService from './deployService.js';

let ensureDomainsSchemaPromise;

function normalizeSubdomain(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function randomSuffix(length = 5) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

function getDefaultSubdomainBase(project) {
  const fromName = normalizeSubdomain(project?.name || '');
  if (fromName) return fromName;

  const idPart = String(project?.id || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 10);

  return idPart ? `app-${idPart}` : `app-${randomSuffix(8)}`;
}

function buildSubdomainSuggestions(base) {
  const safeBase = normalizeSubdomain(base) || 'app';
  return [
    `${safeBase}-${randomSuffix(4)}`,
    `${safeBase}-${randomSuffix(5)}`,
    `${safeBase}-${randomSuffix(6)}`,
  ];
}

function createTxtVerificationToken() {
  return `genesis-verify-${randomSuffix(24)}`;
}

function isValidCustomDomain(value) {
  const raw = String(value || '').trim().toLowerCase();
  const baseDomain = String(process.env.GENESIS_DEPLOY_BASE_DOMAIN || 'genesisapp.in').toLowerCase();
  if (!raw) return false;
  if (raw.length < 4 || raw.length > 253) return false;
  if (raw.endsWith('.')) return false;
  if (raw.includes('..')) return false;
  if (raw.includes(baseDomain)) return false;
  return /^[a-z0-9.-]+$/.test(raw);
}

function getVerificationTargets(projectId) {
  const recordKey = `_genesis.${String(projectId).replace(/-/g, '').slice(0, 12)}`;
  const cnameTarget = `edge.${process.env.GENESIS_DEPLOY_BASE_DOMAIN || 'genesisapp.in'}`;
  return { recordKey, cnameTarget };
}

function getWildcardDomainConfig() {
  const baseDomain = String(process.env.GENESIS_DEPLOY_BASE_DOMAIN || 'genesisapp.in').toLowerCase();
  return {
    baseDomain,
    wildcardDomain: `*.${baseDomain}`,
    recommendation: `Create one wildcard DNS record for *.${baseDomain} pointing to your reverse proxy host.`,
  };
}

async function ensureWildcardDomainSupport() {
  // Wildcard support is DNS-level and requires a single *.baseDomain record.
  // This method returns standard configuration metadata for deployment workflows.
  return getWildcardDomainConfig();
}

async function ensureDomainsSchema() {
  if (!ensureDomainsSchemaPromise) {
    ensureDomainsSchemaPromise = db
      .query(`
        CREATE TABLE IF NOT EXISTS deployment_domains (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
          subdomain VARCHAR(63) NOT NULL UNIQUE,
          deployment_url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_deployment_domains_user_id ON deployment_domains(user_id);
        CREATE INDEX IF NOT EXISTS idx_deployment_domains_project_id ON deployment_domains(project_id);

        CREATE TABLE IF NOT EXISTS custom_domains (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          domain VARCHAR(253) NOT NULL UNIQUE,
          verification_token VARCHAR(120) NOT NULL,
          txt_record_name VARCHAR(120) NOT NULL,
          cname_target VARCHAR(255) NOT NULL,
          verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
          ssl_status VARCHAR(30) NOT NULL DEFAULT 'pending',
          status_message TEXT,
          last_checked_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_custom_domains_user_id ON custom_domains(user_id);
        CREATE INDEX IF NOT EXISTS idx_custom_domains_project_id ON custom_domains(project_id);
      `)
      .catch((err) => {
        ensureDomainsSchemaPromise = null;
        throw err;
      });
  }

  return ensureDomainsSchemaPromise;
}

async function getProjectDomain(projectId) {
  const result = await db.query(
    'SELECT * FROM deployment_domains WHERE project_id = $1 LIMIT 1',
    [projectId]
  );

  return result.rows[0] || null;
}

async function reserveProjectDomain({ userId, project, preferredSubdomain, client = null }) {
  const runner = client || db;
  const existingResult = await runner.query(
    'SELECT * FROM deployment_domains WHERE project_id = $1 LIMIT 1',
    [project.id]
  );
  const existing = existingResult.rows[0] || null;
  if (existing) {
    return {
      subdomain: existing.subdomain,
      deploymentUrl: existing.deployment_url,
      wasExisting: true,
    };
  }

  const requested = normalizeSubdomain(preferredSubdomain);
  const base = requested || getDefaultSubdomainBase(project);

  if (requested) {
    try {
      const deploymentUrl = deployService.buildFrontendUrl({ subdomain: requested });
      const inserted = await runner.query(
        `INSERT INTO deployment_domains (user_id, project_id, subdomain, deployment_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, project.id, requested, deploymentUrl]
      );

      return {
        subdomain: inserted.rows[0].subdomain,
        deploymentUrl: inserted.rows[0].deployment_url,
        wasExisting: false,
      };
    } catch (err) {
      if (err?.code === '23505') {
        const takenError = new Error('Subdomain is already in use.');
        takenError.statusCode = 409;
        takenError.suggestedSubdomains = buildSubdomainSuggestions(base);
        throw takenError;
      }
      throw err;
    }
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix(4)}`;
    const deploymentUrl = deployService.buildFrontendUrl({ subdomain: candidate });

    try {
      const inserted = await runner.query(
        `INSERT INTO deployment_domains (user_id, project_id, subdomain, deployment_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, project.id, candidate, deploymentUrl]
      );

      return {
        subdomain: inserted.rows[0].subdomain,
        deploymentUrl: inserted.rows[0].deployment_url,
        wasExisting: false,
      };
    } catch (err) {
      if (err?.code === '23505') {
        continue;
      }
      throw err;
    }
  }

  const unavailableError = new Error('Could not reserve an available subdomain.');
  unavailableError.statusCode = 503;
  unavailableError.suggestedSubdomains = buildSubdomainSuggestions(base);
  throw unavailableError;
}

async function reassignProjectDomain({ userId, projectId, requestedSubdomain }) {
  const cleaned = normalizeSubdomain(requestedSubdomain);
  if (!cleaned) {
    const err = new Error('A valid subdomain is required.');
    err.statusCode = 400;
    throw err;
  }

  const deploymentUrl = deployService.buildFrontendUrl({ subdomain: cleaned });
  try {
    const result = await db.query(
      `INSERT INTO deployment_domains (user_id, project_id, subdomain, deployment_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id)
       DO UPDATE SET
         subdomain = EXCLUDED.subdomain,
         deployment_url = EXCLUDED.deployment_url,
         updated_at = NOW()
       RETURNING *`,
      [userId, projectId, cleaned, deploymentUrl]
    );

    return {
      subdomain: result.rows[0].subdomain,
      deploymentUrl: result.rows[0].deployment_url,
      wasExisting: false,
    };
  } catch (err) {
    if (err?.code === '23505') {
      const takenError = new Error('Subdomain is already in use.');
      takenError.statusCode = 409;
      takenError.suggestedSubdomains = buildSubdomainSuggestions(cleaned);
      throw takenError;
    }
    throw err;
  }
}

async function updateProjectDomainUrl(projectId, deploymentUrl) {
  await db.query(
    `UPDATE deployment_domains
     SET deployment_url = $1,
         updated_at = NOW()
     WHERE project_id = $2`,
    [deploymentUrl, projectId]
  );
}

async function deleteProjectDomain(projectId) {
  await db.query('DELETE FROM deployment_domains WHERE project_id = $1', [projectId]);
}

async function listUserDomains(userId) {
  const result = await db.query(
    `SELECT
       d.project_id,
       d.subdomain,
       d.deployment_url,
       d.created_at,
       d.updated_at,
       p.name AS project_name,
       p.status AS project_status,
       cd.domain AS custom_domain,
       cd.verification_status,
       cd.ssl_status,
       cd.status_message,
       cd.txt_record_name,
       cd.verification_token,
       cd.cname_target,
       cd.last_checked_at
     FROM deployment_domains d
     JOIN projects p ON p.id = d.project_id
     LEFT JOIN LATERAL (
       SELECT *
       FROM custom_domains x
       WHERE x.project_id = d.project_id
       ORDER BY x.created_at DESC
       LIMIT 1
     ) cd ON TRUE
     WHERE d.user_id = $1
     ORDER BY d.updated_at DESC`,
    [userId]
  );

  return result.rows;
}

async function connectCustomDomain({ userId, projectId, domain }) {
  const normalized = String(domain || '').trim().toLowerCase();
  if (!isValidCustomDomain(normalized)) {
    const err = new Error('Invalid custom domain format.');
    err.statusCode = 400;
    throw err;
  }

  const { recordKey, cnameTarget } = getVerificationTargets(projectId);
  const verificationToken = createTxtVerificationToken();

  const result = await db.query(
    `INSERT INTO custom_domains (
       user_id,
       project_id,
       domain,
       verification_token,
       txt_record_name,
       cname_target,
       verification_status,
       ssl_status,
       status_message,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending', 'Waiting for DNS verification', NOW())
     RETURNING *`,
    [userId, projectId, normalized, verificationToken, recordKey, cnameTarget]
  );

  return result.rows[0];
}

async function verifyCustomDomain({ userId, projectId }) {
  const existing = await db.query(
    `SELECT *
     FROM custom_domains
     WHERE user_id = $1 AND project_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, projectId]
  );

  if (existing.rows.length === 0) {
    const err = new Error('No custom domain is configured for this project.');
    err.statusCode = 404;
    throw err;
  }

  const row = existing.rows[0];

  // Real DNS TXT/CNAME lookup and certificate provisioning should be triggered by gateway.
  const gatewayResult = await deployService.verifyCustomDomainWithGateway({
    domain: row.domain,
    txtRecordName: row.txt_record_name,
    verificationToken: row.verification_token,
    cnameTarget: row.cname_target,
  });

  const verificationStatus = gatewayResult?.verified ? 'verified' : 'pending';
  const sslStatus = gatewayResult?.sslReady ? 'active' : gatewayResult?.verified ? 'provisioning' : 'pending';
  const statusMessage = gatewayResult?.message ||
    (gatewayResult?.verified
      ? 'DNS verified, SSL provisioning in progress.'
      : 'DNS records not detected yet.');

  const updated = await db.query(
    `UPDATE custom_domains
     SET verification_status = $1,
         ssl_status = $2,
         status_message = $3,
         last_checked_at = NOW(),
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [verificationStatus, sslStatus, statusMessage, row.id]
  );

  return updated.rows[0];
}

export default {
  normalizeSubdomain,
  ensureDomainsSchema,
  ensureWildcardDomainSupport,
  getWildcardDomainConfig,
  getProjectDomain,
  reserveProjectDomain,
  reassignProjectDomain,
  updateProjectDomainUrl,
  deleteProjectDomain,
  listUserDomains,
  connectCustomDomain,
  verifyCustomDomain,
};
