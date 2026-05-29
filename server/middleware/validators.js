import fs from 'fs';

function badRequest(res, error) {
  return res.status(400).json({ error });
}

const ALLOWED_INTENT_MODES = new Set(['balanced', 'speed', 'quality', 'refactor', 'debug']);

function validateIntentModeValue(intentMode) {
  if (intentMode === undefined || intentMode === null || intentMode === '') {
    return null;
  }

  const normalized = String(intentMode).trim().toLowerCase();
  if (!ALLOWED_INTENT_MODES.has(normalized)) {
    return 'intentMode must be one of: balanced, speed, quality, refactor, debug.';
  }

  return null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function validateRegister(req, res, next) {
  const { name, email, password } = req.body || {};

  if (!String(name || '').trim()) {
    return badRequest(res, 'Name is required.');
  }

  if (!isValidEmail(email)) {
    return badRequest(res, 'A valid email is required.');
  }

  if (String(password || '').length < 6) {
    return badRequest(res, 'Password must be at least 6 characters.');
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body || {};

  if (!isValidEmail(email)) {
    return badRequest(res, 'A valid email is required.');
  }

  if (!String(password || '').trim()) {
    return badRequest(res, 'Password is required.');
  }

  next();
}

function validateVerifyEmail(req, res, next) {
  const id = req.query.id || req.body?.id;
  const token = req.query.token || req.body?.token;

  if (!id || !token) {
    return badRequest(res, 'id and token are required.');
  }

  if (!isUuid(id)) {
    return badRequest(res, 'id must be a valid UUID.');
  }

  next();
}

function validateResendVerification(req, res, next) {
  const { email } = req.body || {};

  if (!isValidEmail(email)) {
    return badRequest(res, 'A valid email is required.');
  }

  next();
}

function validateForgotPassword(req, res, next) {
  const { email } = req.body || {};

  if (!isValidEmail(email)) {
    return badRequest(res, 'A valid email is required.');
  }

  next();
}

function validateResetPassword(req, res, next) {
  const { id, token, newPassword } = req.body || {};

  if (!id || !token || !newPassword) {
    return badRequest(res, 'id, token, and newPassword are required.');
  }

  if (!isUuid(id)) {
    return badRequest(res, 'id must be a valid UUID.');
  }

  if (String(newPassword).length < 6) {
    return badRequest(res, 'Password must be at least 6 characters.');
  }

  next();
}

function validateProjectIdParam(req, res, next) {
  if (!isUuid(req.params.id)) {
    return badRequest(res, 'Project id must be a valid UUID.');
  }

  next();
}

function validateCreateProject(req, res, next) {
  const { name, prompt, stack, model, intentMode, installNodeModules } = req.body || {};

  if (!String(name || '').trim()) {
    return badRequest(res, 'Project name is required.');
  }

  if (!String(prompt || '').trim()) {
    return badRequest(res, 'Project prompt is required.');
  }

  if (String(prompt).trim().length < 20) {
    return badRequest(res, 'Project prompt must be at least 20 characters.');
  }

  if (stack && typeof stack !== 'string') {
    return badRequest(res, 'stack must be a string.');
  }

  if (model && typeof model !== 'string') {
    return badRequest(res, 'model must be a string.');
  }

  const intentValidationError = validateIntentModeValue(intentMode);
  if (intentValidationError) {
    return badRequest(res, intentValidationError);
  }

  if (installNodeModules !== undefined && typeof installNodeModules !== 'boolean') {
    return badRequest(res, 'installNodeModules must be a boolean.');
  }

  next();
}

function validateEditProject(req, res, next) {
  const { prompt, model, intentMode, installNodeModules } = req.body || {};

  if (!String(prompt || '').trim()) {
    return badRequest(res, 'Edit prompt is required.');
  }

  if (String(prompt).trim().length < 10) {
    return badRequest(res, 'Edit prompt must be at least 10 characters.');
  }

  if (model && typeof model !== 'string') {
    return badRequest(res, 'model must be a string.');
  }

  const intentValidationError = validateIntentModeValue(intentMode);
  if (intentValidationError) {
    return badRequest(res, intentValidationError);
  }

  if (installNodeModules !== undefined && typeof installNodeModules !== 'boolean') {
    return badRequest(res, 'installNodeModules must be a boolean.');
  }

  next();
}

function validateExplainProject(req, res, next) {
  const { question, model, intentMode } = req.body || {};

  if (question !== undefined) {
    if (typeof question !== 'string') {
      return badRequest(res, 'question must be a string.');
    }

    if (question.trim().length > 1500) {
      return badRequest(res, 'question must be 1500 characters or fewer.');
    }
  }

  if (model !== undefined && typeof model !== 'string') {
    return badRequest(res, 'model must be a string.');
  }

  const intentValidationError = validateIntentModeValue(intentMode);
  if (intentValidationError) {
    return badRequest(res, intentValidationError);
  }

  next();
}

function validateProjectFiles(req, res, next) {
  const { files } = req.body || {};
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return badRequest(res, 'files must be an object.');
  }

  next();
}

function validateGithubPush(req, res, next) {
  const { repoName, isPrivate } = req.body || {};

  if (repoName !== undefined && !String(repoName).trim()) {
    return badRequest(res, 'repoName cannot be empty.');
  }

  if (isPrivate !== undefined && typeof isPrivate !== 'boolean') {
    return badRequest(res, 'isPrivate must be a boolean.');
  }

  next();
}

function validateUpdateProfile(req, res, next) {
  const { name, avatar_url } = req.body || {};

  if (name === undefined && avatar_url === undefined) {
    return badRequest(res, 'At least one field (name or avatar_url) is required.');
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return badRequest(res, 'name must be a non-empty string.');
    }
  }

  if (avatar_url !== undefined && typeof avatar_url !== 'string') {
    return badRequest(res, 'avatar_url must be a string.');
  }

  next();
}

function validateDeployBody(req, res, next) {
  const { platform } = req.body || {};

  if (platform === undefined || platform === null || platform === '') {
    req.body.platform = 'genesis-managed';
    return next();
  }

  if (typeof platform !== 'string') {
    return badRequest(res, 'platform must be a string.');
  }

  const normalized = platform.trim().toLowerCase();
  if (!['genesis-managed', 'vercel', 'render', 'docker-cloud'].includes(normalized)) {
    return badRequest(res, 'Platform must be "genesis-managed", "vercel", "render", or "docker-cloud".');
  }

  req.body.platform = normalized;
  next();
}

function validateDeploymentKeys(req, res, next) {
  const {
    vercel_token,
    render_api_key,
    render_owner_id,
    docker_cloud_vps_host,
    docker_cloud_vps_user,
    docker_cloud_vps_port,
    docker_cloud_vps_ssh_private_key,
    docker_cloud_domain,
    docker_cloud_api_domain,
    docker_cloud_ssl_email,
    docker_cloud_provider,
    docker_cloud_enable_kubernetes,
  } = req.body || {};

  if (vercel_token !== undefined && typeof vercel_token !== 'string') {
    return badRequest(res, 'vercel_token must be a string.');
  }

  if (render_api_key !== undefined && typeof render_api_key !== 'string') {
    return badRequest(res, 'render_api_key must be a string.');
  }

  if (render_owner_id !== undefined && typeof render_owner_id !== 'string') {
    return badRequest(res, 'render_owner_id must be a string.');
  }

  if (docker_cloud_vps_host !== undefined && typeof docker_cloud_vps_host !== 'string') {
    return badRequest(res, 'docker_cloud_vps_host must be a string.');
  }

  if (docker_cloud_vps_user !== undefined && typeof docker_cloud_vps_user !== 'string') {
    return badRequest(res, 'docker_cloud_vps_user must be a string.');
  }

  if (docker_cloud_vps_port !== undefined) {
    const parsedPort = Number.parseInt(String(docker_cloud_vps_port), 10);
    if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      return badRequest(res, 'docker_cloud_vps_port must be a valid port number.');
    }
  }

  if (
    docker_cloud_vps_ssh_private_key !== undefined &&
    typeof docker_cloud_vps_ssh_private_key !== 'string'
  ) {
    return badRequest(res, 'docker_cloud_vps_ssh_private_key must be a string.');
  }

  if (docker_cloud_domain !== undefined && typeof docker_cloud_domain !== 'string') {
    return badRequest(res, 'docker_cloud_domain must be a string.');
  }

  if (docker_cloud_api_domain !== undefined && typeof docker_cloud_api_domain !== 'string') {
    return badRequest(res, 'docker_cloud_api_domain must be a string.');
  }

  if (docker_cloud_ssl_email !== undefined && !isValidEmail(docker_cloud_ssl_email)) {
    return badRequest(res, 'docker_cloud_ssl_email must be a valid email.');
  }

  if (docker_cloud_provider !== undefined) {
    const provider = String(docker_cloud_provider).trim().toLowerCase();
    if (!['aws', 'digitalocean', 'vps', ''].includes(provider)) {
      return badRequest(res, 'docker_cloud_provider must be one of: aws, digitalocean, vps.');
    }
  }

  if (
    docker_cloud_enable_kubernetes !== undefined &&
    typeof docker_cloud_enable_kubernetes !== 'boolean'
  ) {
    return badRequest(res, 'docker_cloud_enable_kubernetes must be a boolean.');
  }

  next();
}

function validateOneClickDeployBody(req, res, next) {
  const { projectName, code, maxAttempts, subdomain, env } = req.body || {};

  if (!String(projectName || '').trim()) {
    return badRequest(res, 'projectName is required.');
  }

  if (!code || typeof code !== 'object') {
    return badRequest(res, 'code must be an object containing frontend and backend files.');
  }

  const frontend = code.frontendFiles || code.frontend;
  const backend = code.backendFiles || code.backend;

  if (!frontend || typeof frontend !== 'object') {
    return badRequest(res, 'code.frontendFiles (or code.frontend) must be an object or array of files.');
  }

  if (!backend || typeof backend !== 'object') {
    return badRequest(res, 'code.backendFiles (or code.backend) must be an object or array of files.');
  }

  if (maxAttempts !== undefined) {
    const parsed = Number.parseInt(String(maxAttempts), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3) {
      return badRequest(res, 'maxAttempts must be an integer between 1 and 3.');
    }
  }

  if (subdomain !== undefined) {
    const value = String(subdomain).trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      return badRequest(res, 'subdomain must be lowercase, URL-safe, and hyphenated only.');
    }
  }

  if (env !== undefined && (typeof env !== 'object' || Array.isArray(env))) {
    return badRequest(res, 'env must be an object when provided.');
  }

  next();
}

function validateDeployIdParam(req, res, next) {
  if (!isUuid(req.params.deployId)) {
    return badRequest(res, 'deployId must be a valid UUID.');
  }

  next();
}

function validateContactSubmission(req, res, next) {
  const { name, email, subject, message } = req.body || {};

  if (!String(name || '').trim()) {
    return badRequest(res, 'Name is required.');
  }

  if (!isValidEmail(email)) {
    return badRequest(res, 'A valid email is required.');
  }

  if (!String(subject || '').trim()) {
    return badRequest(res, 'Subject is required.');
  }

  if (String(subject).trim().length > 120) {
    return badRequest(res, 'Subject must be 120 characters or fewer.');
  }

  if (!String(message || '').trim()) {
    return badRequest(res, 'Message is required.');
  }

  if (String(message).trim().length < 10) {
    return badRequest(res, 'Message must be at least 10 characters.');
  }

  if (String(message).trim().length > 5000) {
    return badRequest(res, 'Message must be 5000 characters or fewer.');
  }

  next();
}

function validateNewsletterSubscription(req, res, next) {
  const { email } = req.body || {};

  if (!isValidEmail(email)) {
    return badRequest(res, 'A valid email is required.');
  }

  next();
}

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(String(value).trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateCareerApplication(req, res, next) {
  const {
    roleId,
    fullName,
    email,
    phone,
    yearsExperience,
    linkedinUrl,
    portfolioUrl,
    coverLetter,
    hcaptchaToken,
  } = req.body || {};

  const fail = (message) => {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {
        // Ignore cleanup failure for validation errors.
      });
    }
    return badRequest(res, message);
  };

  if (!String(roleId || '').trim()) {
    return fail('roleId is required.');
  }

  if (!String(fullName || '').trim()) {
    return fail('fullName is required.');
  }

  if (!isValidEmail(email)) {
    return fail('A valid email is required.');
  }

  if (!req.file) {
    return fail('Resume file is required.');
  }

  if (phone && String(phone).trim().length > 50) {
    return fail('phone must be 50 characters or fewer.');
  }

  if (yearsExperience !== undefined && yearsExperience !== null && String(yearsExperience).trim() !== '') {
    const parsed = Number.parseInt(String(yearsExperience), 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 60) {
      return fail('yearsExperience must be a number between 0 and 60.');
    }
  }

  if (!isValidHttpUrl(linkedinUrl)) {
    return fail('linkedinUrl must be a valid http/https URL.');
  }

  if (!isValidHttpUrl(portfolioUrl)) {
    return fail('portfolioUrl must be a valid http/https URL.');
  }

  if (!String(coverLetter || '').trim()) {
    return fail('coverLetter is required.');
  }

  if (String(coverLetter).trim().length < 50) {
    return fail('coverLetter must be at least 50 characters.');
  }

  if (String(coverLetter).trim().length > 5000) {
    return fail('coverLetter must be 5000 characters or fewer.');
  }

  if (hcaptchaToken !== undefined && String(hcaptchaToken).trim().length > 4000) {
    return fail('hcaptchaToken is invalid.');
  }

  next();
}

function validateApplicationIdParam(req, res, next) {
  if (!isUuid(req.params.id)) {
    return badRequest(res, 'Application id must be a valid UUID.');
  }

  next();
}

function validateApplicationStatusUpdate(req, res, next) {
  const status = String(req.body?.status || '').trim().toLowerCase();
  const allowedStatuses = new Set(['new', 'reviewing', 'shortlisted', 'rejected', 'hired', 'archived']);

  if (!allowedStatuses.has(status)) {
    return badRequest(res, 'status must be one of: new, reviewing, shortlisted, rejected, hired, archived.');
  }

  next();
}

function validateApplicationStatusLookup(req, res, next) {
  const applicationId = String(req.body?.applicationId || '').trim();
  const email = String(req.body?.email || '').trim();

  if (!isUuid(applicationId)) {
    return badRequest(res, 'applicationId must be a valid UUID.');
  }

  if (!isValidEmail(email)) {
    return badRequest(res, 'A valid email is required.');
  }

  next();
}

function validateAdminCreateJobRole(req, res, next) {
  const {
    id,
    title,
    department,
    location,
    type,
    summary,
    requirements,
    isActive,
  } = req.body || {};

  if (id !== undefined && !String(id).trim()) {
    return badRequest(res, 'id cannot be empty.');
  }

  if (!String(title || '').trim()) {
    return badRequest(res, 'title is required.');
  }

  if (!String(department || '').trim()) {
    return badRequest(res, 'department is required.');
  }

  if (!String(location || '').trim()) {
    return badRequest(res, 'location is required.');
  }

  if (!String(type || '').trim()) {
    return badRequest(res, 'type is required.');
  }

  if (!String(summary || '').trim()) {
    return badRequest(res, 'summary is required.');
  }

  if (String(summary).trim().length > 1200) {
    return badRequest(res, 'summary must be 1200 characters or fewer.');
  }

  if (!Array.isArray(requirements) || requirements.length === 0) {
    return badRequest(res, 'requirements must be a non-empty array.');
  }

  if (requirements.length > 20) {
    return badRequest(res, 'requirements must have at most 20 items.');
  }

  for (const requirement of requirements) {
    if (!String(requirement || '').trim()) {
      return badRequest(res, 'requirements must contain non-empty strings.');
    }

    if (String(requirement).trim().length > 300) {
      return badRequest(res, 'each requirement must be 300 characters or fewer.');
    }
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return badRequest(res, 'isActive must be a boolean when provided.');
  }

  next();
}

function validateJobRoleIdParam(req, res, next) {
  const roleId = String(req.params.id || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/i.test(roleId)) {
    return badRequest(res, 'Job role id must be 1-120 chars and contain only letters, numbers, or hyphens.');
  }

  next();
}

function validateAdminUpdateJobRole(req, res, next) {
  const { title, department, location, type, summary, requirements, isActive } = req.body || {};

  if (
    title === undefined &&
    department === undefined &&
    location === undefined &&
    type === undefined &&
    summary === undefined &&
    requirements === undefined &&
    isActive === undefined
  ) {
    return badRequest(res, 'At least one field (title, department, location, type, summary, requirements, or isActive) must be provided.');
  }

  if (title !== undefined && !String(title).trim()) {
    return badRequest(res, 'title cannot be empty.');
  }

  if (department !== undefined && !String(department).trim()) {
    return badRequest(res, 'department cannot be empty.');
  }

  if (location !== undefined && !String(location).trim()) {
    return badRequest(res, 'location cannot be empty.');
  }

  if (type !== undefined && !String(type).trim()) {
    return badRequest(res, 'type cannot be empty.');
  }

  if (summary !== undefined && !String(summary).trim()) {
    return badRequest(res, 'summary cannot be empty.');
  }

  if (summary !== undefined && String(summary).length > 1200) {
    return badRequest(res, 'summary must be 1200 characters or fewer.');
  }

  if (requirements !== undefined) {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return badRequest(res, 'requirements must be a non-empty array.');
    }

    if (requirements.length > 20) {
      return badRequest(res, 'requirements must have at most 20 items.');
    }

    for (const requirement of requirements) {
      if (!String(requirement || '').trim()) {
        return badRequest(res, 'requirements must contain non-empty strings.');
      }

      if (String(requirement).length > 300) {
        return badRequest(res, 'each requirement must be 300 characters or fewer.');
      }
    }
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return badRequest(res, 'isActive must be a boolean.');
  }

  next();
}

function validateStartMockInterview(req, res, next) {
  const role = String(req.body?.role || '').trim();
  const model = req.body?.model;

  const fail = (message) => {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {
        // Ignore cleanup failure for validation errors.
      });
    }
    return badRequest(res, message);
  };

  if (!req.file) {
    return fail('Resume file is required.');
  }

  if (role && role.length > 120) {
    return fail('role must be 120 characters or fewer.');
  }

  if (model !== undefined && String(model).trim().length > 80) {
    return fail('model is invalid.');
  }

  next();
}

function validateSuggestMockInterviewRole(req, res, next) {
  const model = req.body?.model;

  const fail = (message) => {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {
        // Ignore cleanup failure for validation errors.
      });
    }
    return badRequest(res, message);
  };

  if (!req.file) {
    return fail('Resume file is required.');
  }

  if (model !== undefined && String(model).trim().length > 80) {
    return fail('model is invalid.');
  }

  next();
}

function validateMockInterviewAnswer(req, res, next) {
  const sessionId = String(req.body?.sessionId || '').trim();
  const answer = String(req.body?.answer || '').trim();
  const model = req.body?.model;

  if (!isUuid(sessionId)) {
    return badRequest(res, 'sessionId must be a valid UUID.');
  }

  if (!answer) {
    return badRequest(res, 'answer is required.');
  }

  if (answer.length < 5) {
    return badRequest(res, 'answer must be at least 5 characters.');
  }

  if (answer.length > 3000) {
    return badRequest(res, 'answer must be 3000 characters or fewer.');
  }

  if (model !== undefined && String(model).trim().length > 80) {
    return badRequest(res, 'model is invalid.');
  }

  next();
}

export default {
  validateRegister,
  validateLogin,
  validateVerifyEmail,
  validateResendVerification,
  validateForgotPassword,
  validateResetPassword,
  validateProjectIdParam,
  validateCreateProject,
  validateEditProject,
  validateExplainProject,
  validateProjectFiles,
  validateGithubPush,
  validateUpdateProfile,
  validateDeployBody,
  validateOneClickDeployBody,
  validateDeploymentKeys,
  validateDeployIdParam,
  validateNewsletterSubscription,
  validateContactSubmission,
  validateCareerApplication,
  validateApplicationIdParam,
  validateApplicationStatusUpdate,
  validateApplicationStatusLookup,
  validateAdminCreateJobRole,
  validateJobRoleIdParam,
  validateAdminUpdateJobRole,
  validateSuggestMockInterviewRole,
  validateStartMockInterview,
  validateMockInterviewAnswer,
};
