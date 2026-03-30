function badRequest(res, error) {
  return res.status(400).json({ error });
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
  const { name, prompt, stack, model } = req.body || {};

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

  next();
}

function validateEditProject(req, res, next) {
  const { prompt, model } = req.body || {};

  if (!String(prompt || '').trim()) {
    return badRequest(res, 'Edit prompt is required.');
  }

  if (String(prompt).trim().length < 10) {
    return badRequest(res, 'Edit prompt must be at least 10 characters.');
  }

  if (model && typeof model !== 'string') {
    return badRequest(res, 'model must be a string.');
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

  if (!['vercel', 'render'].includes(platform)) {
    return badRequest(res, 'Platform must be "vercel" or "render".');
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
  validateProjectFiles,
  validateGithubPush,
  validateUpdateProfile,
  validateDeployBody,
  validateDeployIdParam,
  validateContactSubmission,
};
