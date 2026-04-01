import db from '../config/db.js';
import emailService from '../services/emailService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resumesBaseDir = path.join(__dirname, '../uploads/resumes');
let ensureJobRolesPromise;
let jobsCache = {
  expiresAt: 0,
  value: null,
};
const JOBS_CACHE_TTL_MS = Number.parseInt(String(process.env.JOBS_CACHE_TTL_MS || '30000'), 10);

const defaultCareersJobs = [
  {
    id: 'senior-frontend-engineer',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Remote - India',
    type: 'Full-time',
    summary: 'Build fast, polished product experiences across Genesis.ai web surfaces.',
    requirements: [
      '4+ years building React products in production',
      'Strong understanding of performance and accessibility',
      'Experience with design systems and complex state management',
    ],
  },
  {
    id: 'backend-platform-engineer',
    title: 'Backend Platform Engineer',
    department: 'Engineering',
    location: 'Remote - India',
    type: 'Full-time',
    summary: 'Design resilient backend APIs and platform services for project generation and deployments.',
    requirements: [
      '3+ years with Node.js and PostgreSQL',
      'Experience with API security, rate limiting, and observability',
      'Strong understanding of distributed systems fundamentals',
    ],
  },
  {
    id: 'developer-relations-lead',
    title: 'Developer Relations Lead',
    department: 'Growth',
    location: 'Remote - Global',
    type: 'Full-time',
    summary: 'Help developers succeed with Genesis.ai through content, demos, and community programs.',
    requirements: [
      'Experience in technical writing, demos, and developer advocacy',
      'Strong communication and product storytelling skills',
      'Comfort collaborating with product and engineering teams',
    ],
  },
];

function normalizeRoleRequirements(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function sanitizeRoleRecord(record) {
  if (!record) return null;

  return {
    id: String(record.id || '').trim(),
    title: String(record.title || '').trim(),
    department: String(record.department || '').trim(),
    location: String(record.location || '').trim(),
    type: String(record.type || '').trim(),
    summary: String(record.summary || '').trim(),
    requirements: normalizeRoleRequirements(record.requirements),
    isActive: Boolean(record.is_active),
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
  };
}

async function ensureJobRolesTable() {
  if (!ensureJobRolesPromise) {
    ensureJobRolesPromise = (async () => {
      await db.query(`
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

        CREATE INDEX IF NOT EXISTS idx_job_roles_is_active ON job_roles(is_active);
      `);

      const countResult = await db.query('SELECT COUNT(*)::int AS total FROM job_roles');
      const total = Number(countResult.rows[0]?.total || 0);
      if (total > 0) return;

      for (const role of defaultCareersJobs) {
        await db.query(
          `INSERT INTO job_roles (id, title, department, location, type, summary, requirements, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, TRUE)
           ON CONFLICT (id) DO NOTHING`,
          [
            role.id,
            role.title,
            role.department,
            role.location,
            role.type,
            role.summary,
            JSON.stringify(role.requirements || []),
          ]
        );
      }
    })().catch((err) => {
      ensureJobRolesPromise = null;
      throw err;
    });
  }

  return ensureJobRolesPromise;
}

async function getJobRoles({ includeInactive = false } = {}) {
  await ensureJobRolesTable();

  const rowsResult = await db.query(
    `SELECT
       id,
       title,
       department,
       location,
       type,
       summary,
       requirements,
       is_active,
       created_at,
       updated_at
     FROM job_roles
     ${includeInactive ? '' : 'WHERE is_active = TRUE'}
     ORDER BY created_at DESC`
  );

  return rowsResult.rows.map(sanitizeRoleRecord).filter(Boolean);
}

function readJobsCache() {
  if (!jobsCache.value) return null;
  if (Date.now() >= jobsCache.expiresAt) return null;
  return jobsCache.value;
}

function writeJobsCache(jobs) {
  if (!Array.isArray(jobs)) return;
  jobsCache = {
    value: jobs,
    expiresAt: Date.now() + Math.max(5000, JOBS_CACHE_TTL_MS),
  };
}

function invalidateJobsCache() {
  jobsCache = {
    value: null,
    expiresAt: 0,
  };
}

function slugifyRoleId(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveCareersInbox() {
  return (
    process.env.CAREERS_INBOX_EMAIL ||
    process.env.CONTACT_INBOX_EMAIL ||
    process.env.SMTP_USER ||
    process.env.SMTP_FROM
  );
}

function getAllowedStatuses() {
  return ['new', 'reviewing', 'shortlisted', 'rejected', 'hired', 'archived'];
}

async function verifyHCaptchaToken({ token, remoteIp }) {
  const secret = String(process.env.HCAPTCHA_SECRET || '').trim();

  if (!secret) {
    return {
      success: String(process.env.NODE_ENV || '').toLowerCase() !== 'production',
      reason: 'hCaptcha secret not configured',
    };
  }

  if (!String(token || '').trim()) {
    return { success: false, reason: 'hCaptcha token is missing' };
  }

  const body = new URLSearchParams({
    secret,
    response: String(token),
  });

  if (remoteIp) {
    body.set('remoteip', String(remoteIp));
  }

  const response = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    return { success: false, reason: 'hCaptcha verification request failed' };
  }

  const result = await response.json();
  return {
    success: Boolean(result?.success),
    reason: Array.isArray(result?.['error-codes']) ? result['error-codes'].join(', ') : '',
  };
}

const getJobs = async (_req, res, next) => {
  try {
    const cached = readJobsCache();
    if (cached) {
      return res.json({ jobs: cached, cache: 'hit' });
    }

    const jobs = await getJobRoles();
    writeJobsCache(jobs);
    res.json({ jobs, cache: 'miss' });
  } catch (err) {
    next(err);
  }
};

const applyForJob = async (req, res, next) => {
  try {
    const captchaCheck = await verifyHCaptchaToken({
      token: req.body?.hcaptchaToken,
      remoteIp: req.ip,
    });

    if (!captchaCheck.success) {
      if (req.file?.path) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch (_unlinkErr) {
          // Ignore cleanup failure in captcha reject path.
        }
      }
      return res.status(400).json({ error: 'hCaptcha verification failed. Please try again.' });
    }

    const roleId = String(req.body?.roleId || '').trim();
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const location = String(req.body?.location || '').trim();
    const yearsExperienceRaw = req.body?.yearsExperience;
    const yearsExperience =
      yearsExperienceRaw === undefined || yearsExperienceRaw === null || String(yearsExperienceRaw).trim() === ''
        ? null
        : Number.parseInt(String(yearsExperienceRaw), 10);
    const linkedinUrl = String(req.body?.linkedinUrl || '').trim();
    const portfolioUrl = String(req.body?.portfolioUrl || '').trim();
    const coverLetter = String(req.body?.coverLetter || '').trim();
    const resumeFilePath = req.file?.path ? path.resolve(req.file.path) : null;
    const resumeOriginalName = req.file?.originalname || null;
    const resumeMimeType = req.file?.mimetype || null;
    const resumeSize = req.file?.size || null;

    await ensureJobRolesTable();

    const roleResult = await db.query(
      `SELECT id, title
       FROM job_roles
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [roleId]
    );

    if (roleResult.rows.length === 0) {
      if (req.file?.path) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch (_unlinkErr) {
          // Ignore cleanup failure in invalid role path.
        }
      }
      return res.status(400).json({ error: 'Selected role is not available.' });
    }

    const roleTitle = String(roleResult.rows[0].title || 'General Application');

    const insertResult = await db.query(
      `INSERT INTO job_applications (
         role_id,
         role_title,
         full_name,
         email,
         phone,
         location,
         years_experience,
         linkedin_url,
         portfolio_url,
         resume_file_path,
         resume_original_name,
         resume_mime_type,
         resume_size,
         cover_letter,
         source,
         meta
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
       )
       RETURNING id, created_at`,
      [
        roleId,
        roleTitle,
        fullName,
        email,
        phone || null,
        location || null,
        Number.isNaN(yearsExperience) ? null : yearsExperience,
        linkedinUrl || null,
        portfolioUrl || null,
        resumeFilePath,
        resumeOriginalName,
        resumeMimeType,
        resumeSize,
        coverLetter,
        'website',
        JSON.stringify({
          ip: req.ip,
          userAgent: req.get('user-agent') || null,
        }),
      ]
    );

    const applicationId = insertResult.rows[0].id;

    if (emailService.isEmailConfigured()) {
      const inbox = resolveCareersInbox();
      const safeName = escapeHtml(fullName);
      const safeEmail = escapeHtml(email);
      const safeRole = escapeHtml(roleTitle);
      const safePhone = escapeHtml(phone || 'Not provided');
      const safeLocation = escapeHtml(location || 'Not provided');
      const safeLinkedin = escapeHtml(linkedinUrl || 'Not provided');
      const safePortfolio = escapeHtml(portfolioUrl || 'Not provided');
      const safeResume = escapeHtml(resumeOriginalName || 'Uploaded (secure storage)');
      const safeCoverLetter = escapeHtml(coverLetter).replaceAll('\n', '<br/>');

      try {
        if (inbox) {
          await emailService.sendMail({
            to: inbox,
            subject: `New Job Application - ${roleTitle}`,
            text: [
              `Application ID: ${applicationId}`,
              `Role: ${roleTitle}`,
              `Name: ${fullName}`,
              `Email: ${email}`,
              `Phone: ${phone || 'Not provided'}`,
              `Location: ${location || 'Not provided'}`,
              `Years of Experience: ${yearsExperience ?? 'Not provided'}`,
              `LinkedIn: ${linkedinUrl || 'Not provided'}`,
              `Portfolio: ${portfolioUrl || 'Not provided'}`,
              `Resume File: ${resumeOriginalName || 'Uploaded'}`,
              '',
              'Cover Letter:',
              coverLetter,
            ].join('\n'),
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
                <h2>New Job Application</h2>
                <p><strong>Application ID:</strong> ${applicationId}</p>
                <p><strong>Role:</strong> ${safeRole}</p>
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Phone:</strong> ${safePhone}</p>
                <p><strong>Location:</strong> ${safeLocation}</p>
                <p><strong>Years of Experience:</strong> ${yearsExperience ?? 'Not provided'}</p>
                <p><strong>LinkedIn:</strong> ${safeLinkedin}</p>
                <p><strong>Portfolio:</strong> ${safePortfolio}</p>
                <p><strong>Resume:</strong> ${safeResume} (available in admin panel)</p>
                <p><strong>Cover Letter:</strong><br/>${safeCoverLetter}</p>
              </div>
            `,
          });
        }

        await emailService.sendMail({
          to: email,
          subject: 'Application received - Genesis.ai Careers',
          text: [
            `Hi ${fullName},`,
            '',
            `Thanks for applying to the ${roleTitle} role at Genesis.ai.`,
            'Our team has received your application and will review it shortly.',
            '',
            `Application ID: ${applicationId}`,
            '',
            '- Genesis.ai Hiring Team',
          ].join('\n'),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
              <h2>Application Received</h2>
              <p>Hi ${escapeHtml(fullName)},</p>
              <p>Thanks for applying to the <strong>${safeRole}</strong> role at Genesis.ai.</p>
              <p>Our hiring team has received your application and will review it shortly.</p>
              <p><strong>Application ID:</strong> ${applicationId}</p>
              <p style="margin-top: 24px;">- Genesis.ai Hiring Team</p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.error('Careers email delivery failed:', mailErr.message);
      }
    }

    res.status(201).json({
      message: 'Application submitted successfully.',
      applicationId,
    });
  } catch (err) {
    if (req.file?.path) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (_unlinkErr) {
        // Ignore cleanup failure in error path.
      }
    }
    next(err);
  }
};

const listApplications = async (req, res, next) => {
  try {
    await ensureJobRolesTable();

    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSizeRaw = Number.parseInt(String(req.query.pageSize || '20'), 10) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const status = String(req.query.status || '').trim().toLowerCase();
    const roleId = String(req.query.roleId || '').trim();
    const query = String(req.query.q || '').trim();

    const values = [];
    const whereClauses = [];

    if (status) {
      values.push(status);
      whereClauses.push(`status = $${values.length}`);
    }

    if (roleId) {
      values.push(roleId);
      whereClauses.push(`role_id = $${values.length}`);
    }

    if (query) {
      values.push(`%${query}%`);
      whereClauses.push(`(full_name ILIKE $${values.length} OR email ILIKE $${values.length})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM job_applications ${whereSql}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;

    values.push(pageSize, offset);

    const rowsResult = await db.query(
      `SELECT
         id,
         role_id,
         role_title,
         full_name,
         email,
         phone,
         location,
         years_experience,
         linkedin_url,
         portfolio_url,
         resume_original_name,
         resume_mime_type,
         resume_size,
         cover_letter,
         status,
         source,
         created_at,
         updated_at
       FROM job_applications
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values
    );

    res.json({
      applications: rowsResult.rows,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      filters: {
        status: status || null,
        roleId: roleId || null,
        q: query || null,
      },
      statuses: getAllowedStatuses(),
    });
  } catch (err) {
    next(err);
  }
};

const getApplicationStatus = async (req, res, next) => {
  try {
    const applicationId = String(req.body?.applicationId || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();

    const result = await db.query(
      `SELECT
         id,
         role_id,
         role_title,
         full_name,
         status,
         created_at,
         updated_at
       FROM job_applications
       WHERE id = $1 AND LOWER(email) = $2
       LIMIT 1`,
      [applicationId, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No application found for this Application ID and email.',
      });
    }

    return res.json({
      application: result.rows[0],
      statuses: getAllowedStatuses(),
    });
  } catch (err) {
    return next(err);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const status = String(req.body?.status || '').trim().toLowerCase();

    const appResult = await db.query(
      `SELECT id, email, full_name, role_title, status
       FROM job_applications
       WHERE id = $1`,
      [applicationId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const application = appResult.rows[0];
    const oldStatus = application.status;

    const updateResult = await db.query(
      `UPDATE job_applications
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, email, full_name, role_title, updated_at`,
      [status, applicationId]
    );

    const updatedApp = updateResult.rows[0];

    if (emailService.isEmailConfigured() && updatedApp.email && oldStatus !== status) {
      const candidateEmail = updatedApp.email;
      const candidateName = updatedApp.full_name || 'Candidate';
      const roleTitle = updatedApp.role_title || 'the role';

      const statusTriggers = ['hired', 'shortlisted', 'rejected'];
      if (statusTriggers.includes(status)) {
        try {
          if (status === 'hired') {
            await emailService.sendHiredNotificationEmail({
              to: candidateEmail,
              name: candidateName,
              roleTitle,
              applicationId,
            });
          } else if (status === 'shortlisted') {
            await emailService.sendShortlistedNotificationEmail({
              to: candidateEmail,
              name: candidateName,
              roleTitle,
              applicationId,
            });
          } else if (status === 'rejected') {
            await emailService.sendRejectionNotificationEmail({
              to: candidateEmail,
              name: candidateName,
              roleTitle,
              applicationId,
            });
          }
        } catch (mailErr) {
          console.error('Careers status notification email failed:', mailErr.message);
        }
      }
    }

    return res.json({ application: updatedApp });
  } catch (err) {
    return next(err);
  }
};

const listJobRoles = async (_req, res, next) => {
  try {
    const roles = await getJobRoles({ includeInactive: true });
    return res.json({ roles });
  } catch (err) {
    return next(err);
  }
};

const createJobRole = async (req, res, next) => {
  try {
    await ensureJobRolesTable();

    const title = String(req.body?.title || '').trim();
    const department = String(req.body?.department || '').trim();
    const location = String(req.body?.location || '').trim();
    const type = String(req.body?.type || '').trim();
    const summary = String(req.body?.summary || '').trim();
    const requirements = normalizeRoleRequirements(req.body?.requirements);
    const isActive = req.body?.isActive === undefined ? true : Boolean(req.body?.isActive);

    let roleId = String(req.body?.id || '').trim();
    if (!roleId) {
      roleId = slugifyRoleId(title);
    }

    if (!roleId) {
      return res.status(400).json({ error: 'Unable to generate role id. Provide a valid id or title.' });
    }

    const insertResult = await db.query(
      `INSERT INTO job_roles (id, title, department, location, type, summary, requirements, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING
         id,
         title,
         department,
         location,
         type,
         summary,
         requirements,
         is_active,
         created_at,
         updated_at`,
      [roleId, title, department, location, type, summary, JSON.stringify(requirements), isActive]
    );

    invalidateJobsCache();

    return res.status(201).json({
      role: sanitizeRoleRecord(insertResult.rows[0]),
      message: 'Job role created successfully.',
    });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'A job role with this id already exists.' });
    }
    return next(err);
  }
};

const deleteJobRole = async (req, res, next) => {
  try {
    await ensureJobRolesTable();

    const result = await db.query(
      `UPDATE job_roles
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         title,
         department,
         location,
         type,
         summary,
         requirements,
         is_active,
         created_at,
         updated_at`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job role not found.' });
    }

    invalidateJobsCache();

    return res.json({
      role: sanitizeRoleRecord(result.rows[0]),
      message: 'Job role deleted successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

const updateJobRole = async (req, res, next) => {
  try {
    await ensureJobRolesTable();

    const roleId = req.params.id;
    const title = req.body?.title !== undefined ? String(req.body.title).trim() : null;
    const department = req.body?.department !== undefined ? String(req.body.department).trim() : null;
    const location = req.body?.location !== undefined ? String(req.body.location).trim() : null;
    const type = req.body?.type !== undefined ? String(req.body.type).trim() : null;
    const summary = req.body?.summary !== undefined ? String(req.body.summary).trim() : null;
    const requirements = req.body?.requirements !== undefined ? normalizeRoleRequirements(req.body.requirements) : null;
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : null;

    const updates = [];
    const values = [roleId];
    let paramIndex = 2;

    if (title !== null) {
      updates.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }
    if (department !== null) {
      updates.push(`department = $${paramIndex}`);
      values.push(department);
      paramIndex++;
    }
    if (location !== null) {
      updates.push(`location = $${paramIndex}`);
      values.push(location);
      paramIndex++;
    }
    if (type !== null) {
      updates.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }
    if (summary !== null) {
      updates.push(`summary = $${paramIndex}`);
      values.push(summary);
      paramIndex++;
    }
    if (requirements !== null) {
      updates.push(`requirements = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(requirements));
      paramIndex++;
    }
    if (isActive !== null) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'At least one field must be provided for update.' });
    }

    updates.push('updated_at = NOW()');

    const result = await db.query(
      `UPDATE job_roles
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING
         id,
         title,
         department,
         location,
         type,
         summary,
         requirements,
         is_active,
         created_at,
         updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job role not found.' });
    }

    invalidateJobsCache();

    return res.json({
      role: sanitizeRoleRecord(result.rows[0]),
      message: 'Job role updated successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

const downloadApplicationResume = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT resume_file_path, resume_original_name, resume_mime_type
       FROM job_applications
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const filePath = result.rows[0].resume_file_path;
    const originalName = result.rows[0].resume_original_name || 'resume';
    const mimeType = result.rows[0].resume_mime_type || 'application/octet-stream';

    if (!filePath) {
      return res.status(404).json({ error: 'Resume is not available for this application.' });
    }

    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(resumesBaseDir) + path.sep)) {
      return res.status(403).json({ error: 'Invalid resume path.' });
    }

    await fs.promises.access(resolvedPath);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName.replaceAll('"', '')}"`);
    return res.sendFile(resolvedPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Resume file not found.' });
    }
    return next(err);
  }
};

export default {
  getJobs,
  applyForJob,
  listJobRoles,
  createJobRole,
  updateJobRole,
  deleteJobRole,
  listApplications,
  getApplicationStatus,
  updateApplicationStatus,
  downloadApplicationResume,
};
