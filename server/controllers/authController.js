import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import https from 'https';
import db from '../config/db.js';
import emailService from '../services/emailService.js';

let ensureVerificationColumnsPromise;

function ensureVerificationColumns() {
  if (!ensureVerificationColumnsPromise) {
    ensureVerificationColumnsPromise = db
      .query(`
        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS email_verification_status VARCHAR(10) NOT NULL DEFAULT 'false';

        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS email_verification_error TEXT;
      `)
      .catch((err) => {
        ensureVerificationColumnsPromise = null;
        throw err;
      });
  }

  return ensureVerificationColumnsPromise;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET', headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function redirectWithOAuthLog(res, label, url, provider = 'OAuth') {
  console.log(`[${provider}] ${label}: ${url}`);
  return res.redirect(url);
}

function isLocalhostUrl(value) {
  if (!value) return false;

  try {
    const parsed = new URL(String(value).trim());
    const hostname = String(parsed.hostname || '').toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  } catch {
    const lower = String(value).trim().toLowerCase();
    return lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('0.0.0.0');
  }
}

function isLocalhostHost(value) {
  const host = String(value || '').trim().toLowerCase();
  if (!host) return false;

  const hostname = host.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function shouldIgnoreLocalhostEnvUrl(req, urlValue) {
  if (!isLocalhostUrl(urlValue)) return false;

  const forwardedHost = req?.headers?.['x-forwarded-host'];
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  const requestHost = hostHeader || req?.get?.('host') || '';

  // Keep localhost values only when handling true local requests.
  if (isLocalhostHost(requestHost)) return false;

  // If request is from a real host, localhost env URLs are invalid and must be ignored.
  return Boolean(requestHost);
}

function sanitizeEnvUrl(req, urlValue, label) {
  const raw = urlValue?.trim();
  if (!raw) return null;

  if (isProduction() && isLocalhostUrl(raw)) {
    console.warn(`[Auth URL Resolver] Ignoring ${label} because it points to localhost in production: ${raw}`);
    return null;
  }

  if (shouldIgnoreLocalhostEnvUrl(req, raw)) {
    console.warn(`[Auth URL Resolver] Ignoring ${label} because request host is non-local while env URL is localhost: ${raw}`);
    return null;
  }

  return raw.replace(/\/$/, '');
}

function resolveGithubRedirectUri(req) {
  const envRedirectUri = sanitizeEnvUrl(req, process.env.GITHUB_REDIRECT_URI, 'GITHUB_REDIRECT_URI');
  if (envRedirectUri) return envRedirectUri;

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/api/auth/callback/github`;
}

function resolveGoogleRedirectUri(req) {
  const envRedirectUri = sanitizeEnvUrl(req, process.env.GOOGLE_REDIRECT_URI, 'GOOGLE_REDIRECT_URI');
  if (envRedirectUri) return envRedirectUri;

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/api/auth/callback/google`;
}

function resolveApiBaseUrl(req) {
  const envApiUrl = sanitizeEnvUrl(req, process.env.API_URL, 'API_URL');
  if (envApiUrl) return envApiUrl;

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

function resolveClientBaseUrl(req) {
  const envClientUrl = sanitizeEnvUrl(req, process.env.CLIENT_URL, 'CLIENT_URL');
  if (envClientUrl) return envClientUrl;

  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const safeOrigin = sanitizeEnvUrl(req, origin || '', 'Origin header');
  if (safeOrigin) return safeOrigin;

  return resolveServerBaseUrl(req);
}

function resolveServerBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

function buildEmailVerificationToken(user) {
  const secret = `${process.env.JWT_SECRET}${user.password}`;
  return jwt.sign({ id: user.id, email: user.email, purpose: 'email_verification' }, secret, {
    expiresIn: '24h',
  });
}

async function sendVerificationEmail(req, user) {
  const token = buildEmailVerificationToken(user);
  const verifyUrl = `${resolveApiBaseUrl(req)}/api/auth/verify-email?id=${encodeURIComponent(user.id)}&token=${encodeURIComponent(token)}`;
  return emailService.sendEmailVerificationEmail({
    to: user.email,
    name: user.name,
    verificationUrl: verifyUrl,
  });
}

const register = async (req, res, next) => {
  try {
    await ensureVerificationColumns();

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (name, email, password, email_verification_status, email_verification_error)
       VALUES ($1, $2, $3, 'false', NULL)
       RETURNING id, name, email, password, email_verified_at, email_verification_status, email_verification_error, created_at`,
      [name, email, hashedPassword]
    );

    const user = result.rows[0];

    // Registration should succeed even when email delivery fails.
    try {
      await sendVerificationEmail(req, user);
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr.message);
    }

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({
      user: userWithoutPassword,
      requiresEmailVerification: true,
      message: 'Registration successful. Please verify your email before logging in.',
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.email_verified_at && !user.github_id) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        requiresEmailVerification: true,
      });
    }

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    await ensureVerificationColumns();

    const result = await db.query(
      'SELECT id, name, email, avatar_url, email_verified_at, email_verification_status, email_verification_error, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    await ensureVerificationColumns();

    const { name, avatar_url } = req.body || {};

    const nextName = name !== undefined ? String(name).trim() : null;
    const nextAvatarRaw = avatar_url !== undefined ? String(avatar_url).trim() : null;

    if (nextAvatarRaw && !/^https?:\/\//i.test(nextAvatarRaw)) {
      return res.status(400).json({ error: 'avatar_url must start with http:// or https://.' });
    }

    const result = await db.query(
      `UPDATE users
       SET
         name = COALESCE($1, name),
         avatar_url = CASE
           WHEN $2::text IS NULL THEN avatar_url
           WHEN $2 = '' THEN NULL
           ELSE $2
         END,
         updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, email, avatar_url, email_verified_at, email_verification_status, email_verification_error, created_at`,
      [nextName, nextAvatarRaw, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const uploadProfileImage = async (req, res, next) => {
  try {
    await ensureVerificationColumns();

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required.' });
    }

    const avatarUrl = `${resolveServerBaseUrl(req)}/uploads/avatars/${req.file.filename}`;

    const result = await db.query(
      `UPDATE users
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, avatar_url, email_verified_at, email_verification_status, email_verification_error, created_at`,
      [avatarUrl, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      message: 'Profile image uploaded successfully.',
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const updateGithubToken = async (req, res, next) => {
  try {
    const { github_token } = req.body;
    await db.query('UPDATE users SET github_token = $1, updated_at = NOW() WHERE id = $2', [
      github_token,
      req.user.id,
    ]);
    res.json({ message: 'GitHub token updated successfully.' });
  } catch (err) {
    next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    await ensureVerificationColumns();

    const id = req.query.id || req.body?.id;
    const token = req.query.token || req.body?.token;

    if (!id || !token) {
      return res.status(400).json({ error: 'id and token are required.' });
    }

    const result = await db.query('SELECT id, name, email, password, email_verified_at, email_verification_status FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    const user = result.rows[0];
    const secret = `${process.env.JWT_SECRET}${user.password}`;

    try {
      const decoded = jwt.verify(token, secret);
      if (decoded.purpose !== 'email_verification' || decoded.id !== user.id) {
        await db.query(
          'UPDATE users SET email_verification_status = $1, email_verification_error = $2, updated_at = NOW() WHERE id = $3',
          ['error', 'Invalid or expired verification token.', id]
        );
        return res.status(400).json({ error: 'Invalid or expired verification token.' });
      }
    } catch {
      await db.query(
        'UPDATE users SET email_verification_status = $1, email_verification_error = $2, updated_at = NOW() WHERE id = $3',
        ['error', 'Invalid or expired verification token.', id]
      );
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    const wasAlreadyVerified = Boolean(user.email_verified_at);
    if (!wasAlreadyVerified) {
      await db.query(
        'UPDATE users SET email_verified_at = NOW(), email_verification_status = $1, email_verification_error = NULL, updated_at = NOW() WHERE id = $2',
        ['true', id]
      );
      try {
        await emailService.sendWelcomeEmail({ to: user.email, name: user.name });
      } catch (emailErr) {
        console.error('Welcome email failed after verification:', emailErr.message);
      }
    } else if (user.email_verification_status !== 'true') {
      await db.query(
        'UPDATE users SET email_verification_status = $1, email_verification_error = NULL, updated_at = NOW() WHERE id = $2',
        ['true', id]
      );
    }

    if (req.query.id && req.query.token) {
      const successRedirect = `${resolveClientBaseUrl(req)}/login?verified=true`;
      return res.redirect(successRedirect);
    }

    return res.json({
      message: wasAlreadyVerified ? 'Email is already verified.' : 'Email verified successfully.',
      verified: true,
    });
  } catch (err) {
    next(err);
  }
};

const resendVerificationEmail = async (req, res, next) => {
  try {
    await ensureVerificationColumns();

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const result = await db.query('SELECT id, name, email, password, email_verified_at FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.json({ message: 'If this email is registered, a verification email has been sent.' });
    }

    const user = result.rows[0];
    if (!user.email_verified_at) {
      await db.query(
        'UPDATE users SET email_verification_status = $1, email_verification_error = NULL, updated_at = NOW() WHERE id = $2',
        ['false', user.id]
      );
      try {
        await sendVerificationEmail(req, user);
      } catch (emailErr) {
        console.error('Resend verification email failed:', emailErr.message);
      }
    }

    return res.json({ message: 'If this email is registered, a verification email has been sent.' });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const result = await db.query('SELECT id, name, email, password FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Keep response generic to avoid user enumeration.
      return res.json({ message: 'If this email is registered, a password reset link has been sent.' });
    }

    const user = result.rows[0];
    const secret = `${process.env.JWT_SECRET}${user.password}`;
    const resetToken = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '15m' });
    const resetUrl = `${resolveClientBaseUrl(req)}/reset-password?id=${encodeURIComponent(user.id)}&token=${encodeURIComponent(resetToken)}`;

    try {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (emailErr) {
      console.error('Password reset email failed:', emailErr.message);
    }

    return res.json({ message: 'If this email is registered, a password reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { id, token, newPassword } = req.body;

    if (!id || !token || !newPassword) {
      return res.status(400).json({ error: 'id, token, and newPassword are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const userResult = await db.query('SELECT id, email, password FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const user = userResult.rows[0];
    const secret = `${process.env.JWT_SECRET}${user.password}`;

    try {
      jwt.verify(token, secret);
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [
      hashedPassword,
      id,
    ]);

    return res.json({ message: 'Password reset successful.' });
  } catch (err) {
    next(err);
  }
};

// GitHub OAuth: redirect user to GitHub authorization page
const githubRedirect = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = resolveGithubRedirectUri(req);
  
  if (!clientId) {
    console.error('[GitHub OAuth] ERROR: GITHUB_CLIENT_ID not configured in environment');
    return res.status(500).json({ error: 'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' });
  }
  
  console.log('[GitHub OAuth] Initiating GitHub login');
  console.log('[GitHub OAuth] Redirect URI:', redirectUri);
  console.log('[GitHub OAuth] Client ID:', clientId.substring(0, 5) + '****');
  
  const scope = 'user:email repo';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
  return redirectWithOAuthLog(res, 'redirect_to_github_authorize', url);
};

// GitHub OAuth: handle callback, exchange code for token, find/create user
const githubCallback = async (req, res, next) => {
  try {
    await ensureVerificationColumns();

    const clientBaseUrl = resolveClientBaseUrl(req);
    const { code } = req.query;
    if (!code) {
      const redirectUrl = `${clientBaseUrl}/login?error=github_no_code`;
      return redirectWithOAuthLog(res, 'missing_code_redirect', redirectUrl);
    }

    // Exchange code for access token
    const tokenBody = `client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}&code=${code}`;
    const tokenResponse = await httpsPost(
      {
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      },
      tokenBody
    );

    const tokenData = JSON.parse(tokenResponse);
    if (tokenData.error || !tokenData.access_token) {
      const redirectUrl = `${clientBaseUrl}/login?error=github_token_failed`;
      return redirectWithOAuthLog(res, 'token_exchange_failed_redirect', redirectUrl);
    }

    const accessToken = tokenData.access_token;

    // Fetch GitHub user profile
    const ghUser = await httpsGet('https://api.github.com/user', {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Genesis.ai',
    });

    const githubId = String(ghUser.id);
    const githubLogin = ghUser.login || `github-${githubId}`;

    // Fetch primary email if not public
    let email = ghUser.email;
    if (!email) {
      const emailsResponse = await httpsGet('https://api.github.com/user/emails', {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Genesis.ai',
      });
      const emails = Array.isArray(emailsResponse) ? emailsResponse : [];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary ? primary.email : emails[0]?.email;
    }

    if (!email) {
      // Allow OAuth signup/login even when account email is private/unavailable.
      email = `${githubId}+${githubLogin}@users.noreply.github.com`;
      console.log('[GitHub OAuth] email_unavailable_using_fallback:', email);
    }

    const name = ghUser.name || githubLogin;
    const avatarUrl = ghUser.avatar_url;

    // Find existing user by github_id or email
    let userResult = await db.query(
      'SELECT * FROM users WHERE github_id = $1 OR email = $2 LIMIT 1',
      [githubId, email]
    );

    let user;
    if (userResult.rows.length > 0) {
      // Update existing user with latest GitHub info
      user = userResult.rows[0];
      await db.query(
        'UPDATE users SET github_id = $1, github_token = $2, avatar_url = $3, email_verified_at = COALESCE(email_verified_at, NOW()), email_verification_status = $4, email_verification_error = NULL, updated_at = NOW() WHERE id = $5',
        [githubId, accessToken, avatarUrl, 'true', user.id]
      );
    } else {
      // Create new user (no password needed for OAuth)
      const result = await db.query(
        `INSERT INTO users
         (name, email, github_id, github_token, avatar_url, password, email_verified_at, email_verification_status, email_verification_error)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'true', NULL)
         RETURNING *`,
        [name, email, githubId, accessToken, avatarUrl, 'GITHUB_OAUTH']
      );
      user = result.rows[0];
    }

    const token = generateToken(user);

    // Redirect to client with JWT token
    const redirectUrl = `${clientBaseUrl}/auth/github/callback?token=${token}`;
    return redirectWithOAuthLog(res, 'oauth_success_redirect', redirectUrl, 'GitHub OAuth');
  } catch (err) {
    console.error('GitHub OAuth error:', err);
    const redirectUrl = `${resolveClientBaseUrl(req)}/login?error=github_failed`;
    return redirectWithOAuthLog(res, 'oauth_error_redirect', redirectUrl, 'GitHub OAuth');
  }
};

const googleRedirect = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = resolveGoogleRedirectUri(req);

  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }

  const scope = 'openid email profile';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return redirectWithOAuthLog(res, 'redirect_to_google_authorize', url, 'Google OAuth');
};

const googleCallback = async (req, res) => {
  try {
    await ensureVerificationColumns();

    const clientBaseUrl = resolveClientBaseUrl(req);
    const { code, error, error_description: errorDescription } = req.query;

    if (error) {
      const safeError = String(error);
      const safeDescription = encodeURIComponent(String(errorDescription || ''));
      const redirectUrl = `${clientBaseUrl}/login?error=google_${encodeURIComponent(safeError)}${safeDescription ? `&error_description=${safeDescription}` : ''}`;
      return redirectWithOAuthLog(res, 'provider_error_redirect', redirectUrl, 'Google OAuth');
    }

    if (!code) {
      const redirectUrl = `${clientBaseUrl}/login?error=google_no_code`;
      return redirectWithOAuthLog(res, 'missing_code_redirect', redirectUrl, 'Google OAuth');
    }

    const redirectUri = resolveGoogleRedirectUri(req);
    const tokenBody = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString();

    const tokenResponseRaw = await httpsPost(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      },
      tokenBody
    );

    const tokenData = JSON.parse(tokenResponseRaw || '{}');
    if (tokenData.error || !tokenData.access_token) {
      const redirectUrl = `${clientBaseUrl}/login?error=google_token_failed`;
      return redirectWithOAuthLog(res, 'token_exchange_failed_redirect', redirectUrl, 'Google OAuth');
    }

    const googleUser = await httpsGet('https://openidconnect.googleapis.com/v1/userinfo', {
      Authorization: `Bearer ${tokenData.access_token}`,
    });

    const email = googleUser.email;
    if (!email) {
      const redirectUrl = `${clientBaseUrl}/login?error=google_no_email`;
      return redirectWithOAuthLog(res, 'missing_email_redirect', redirectUrl, 'Google OAuth');
    }

    const name = googleUser.name || googleUser.given_name || email.split('@')[0];
    const avatarUrl = googleUser.picture || null;

    const existingUserResult = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);

    let user;
    if (existingUserResult.rows.length > 0) {
      user = existingUserResult.rows[0];
      await db.query(
        'UPDATE users SET avatar_url = COALESCE($1, avatar_url), email_verified_at = COALESCE(email_verified_at, NOW()), email_verification_status = $2, email_verification_error = NULL, updated_at = NOW() WHERE id = $3',
        [avatarUrl, 'true', user.id]
      );
    } else {
      const insertResult = await db.query(
        `INSERT INTO users
         (name, email, avatar_url, password, email_verified_at, email_verification_status, email_verification_error)
         VALUES ($1, $2, $3, $4, NOW(), 'true', NULL)
         RETURNING *`,
        [name, email, avatarUrl, 'GOOGLE_OAUTH']
      );
      user = insertResult.rows[0];
    }

    const token = generateToken(user);
    const redirectUrl = `${clientBaseUrl}/auth/google/callback?token=${token}`;
    return redirectWithOAuthLog(res, 'oauth_success_redirect', redirectUrl, 'Google OAuth');
  } catch (err) {
    console.error('Google OAuth error:', err);
    const redirectUrl = `${resolveClientBaseUrl(req)}/login?error=google_failed`;
    return redirectWithOAuthLog(res, 'oauth_error_redirect', redirectUrl, 'Google OAuth');
  }
};

export default {
  register,
  login,
  getMe,
  updateProfile,
  uploadProfileImage,
  updateGithubToken,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  githubRedirect,
  githubCallback,
  googleRedirect,
  googleCallback,
};
