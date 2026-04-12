import db from '../config/db.js';
import domainService from '../services/domainService.js';
import deployService from '../services/deployService.js';

async function getProjectOwnedByUser(projectId, userId) {
  const result = await db.query(
    'SELECT id, name, user_id, status, deploy_url, deploy_frontend_url, deploy_backend_url FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1',
    [projectId, userId]
  );

  return result.rows[0] || null;
}

const listDomains = async (req, res, next) => {
  try {
    await domainService.ensureDomainsSchema();
    const domains = await domainService.listUserDomains(req.user.id);
    return res.json({ domains });
  } catch (err) {
    return next(err);
  }
};

const reassignSubdomain = async (req, res, next) => {
  try {
    await domainService.ensureDomainsSchema();

    const { projectId, subdomain } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required.' });
    }

    const project = await getProjectOwnedByUser(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const currentDomain = await domainService.getProjectDomain(projectId);
    const nextDomain = await domainService.reassignProjectDomain({
      userId: req.user.id,
      projectId,
      requestedSubdomain: subdomain,
    });

    try {
      await deployService.registerGenesisRoute?.({
        subdomain: nextDomain.subdomain,
        projectId,
        userId: req.user.id,
        target: 'frontend',
      });
    } catch {
      // Route registration can fail when gateway is unavailable; keep reservation persisted.
    }

    if (currentDomain?.subdomain && currentDomain.subdomain !== nextDomain.subdomain) {
      try {
        await deployService.releaseGenesisRoute({
          subdomain: currentDomain.subdomain,
          projectId,
          userId: req.user.id,
        });
      } catch {
        // Best effort release.
      }
    }

    await db.query(
      `UPDATE projects
       SET deploy_url = $1,
           deploy_frontend_url = $1,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [nextDomain.deployment_url, projectId, req.user.id]
    );

    return res.json({
      message: 'Subdomain reassigned successfully.',
      domain: nextDomain,
    });
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({
        error: err.message,
        suggestedSubdomains: err.suggestedSubdomains || [],
      });
    }

    return next(err);
  }
};

const releaseSubdomain = async (req, res, next) => {
  try {
    await domainService.ensureDomainsSchema();

    const { projectId } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required.' });
    }

    const project = await getProjectOwnedByUser(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const currentDomain = await domainService.getProjectDomain(projectId);
    if (!currentDomain) {
      return res.status(404).json({ error: 'No subdomain is assigned to this project.' });
    }

    await domainService.deleteProjectDomain(projectId);

    try {
      await deployService.releaseGenesisRoute({
        subdomain: currentDomain.subdomain,
        projectId,
        userId: req.user.id,
      });
    } catch {
      // Best effort release.
    }

    await db.query(
      `UPDATE projects
       SET deploy_frontend_url = NULL,
           deploy_url = COALESCE(deploy_backend_url, NULL),
           status = CASE WHEN deploy_backend_url IS NULL THEN 'ready' ELSE status END,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [projectId, req.user.id]
    );

    return res.json({ message: 'Subdomain released successfully.' });
  } catch (err) {
    return next(err);
  }
};

const connectCustomDomain = async (req, res, next) => {
  try {
    await domainService.ensureDomainsSchema();

    const { projectId, domain } = req.body || {};
    if (!projectId || !domain) {
      return res.status(400).json({ error: 'projectId and domain are required.' });
    }

    const project = await getProjectOwnedByUser(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const customDomain = await domainService.connectCustomDomain({
      userId: req.user.id,
      projectId,
      domain,
    });

    return res.status(201).json({
      message: 'Custom domain created. Add TXT and CNAME records, then verify.',
      customDomain,
    });
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    if (err?.code === '23505') {
      return res.status(409).json({ error: 'This custom domain is already linked to another project.' });
    }

    return next(err);
  }
};

const verifyCustomDomain = async (req, res, next) => {
  try {
    await domainService.ensureDomainsSchema();

    const { projectId } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required.' });
    }

    const project = await getProjectOwnedByUser(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const customDomain = await domainService.verifyCustomDomain({
      userId: req.user.id,
      projectId,
    });

    return res.json({
      message: 'Custom domain verification check completed.',
      customDomain,
    });
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    return next(err);
  }
};

export default {
  listDomains,
  reassignSubdomain,
  releaseSubdomain,
  connectCustomDomain,
  verifyCustomDomain,
};
