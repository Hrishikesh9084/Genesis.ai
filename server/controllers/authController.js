import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import https from 'https';
import db from '../config/db.js';

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

function redirectWithOAuthLog(res, label, url) {
  console.log(`[GitHub OAuth] ${label}: ${url}`);
  return res.redirect(url);
}

const register = async (req, res, next) => {
  try {
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
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({ user, token });
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

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, avatar_url, created_at FROM users WHERE id = $1',
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

// GitHub OAuth: redirect user to GitHub authorization page
const githubRedirect = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/callback/github`;
  const scope = 'user:email repo';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
  return redirectWithOAuthLog(res, 'redirect_to_github_authorize', url);
};

// GitHub OAuth: handle callback, exchange code for token, find/create user
const githubCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      const redirectUrl = `${process.env.CLIENT_URL}/login?error=github_no_code`;
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
      const redirectUrl = `${process.env.CLIENT_URL}/login?error=github_token_failed`;
      return redirectWithOAuthLog(res, 'token_exchange_failed_redirect', redirectUrl);
    }

    const accessToken = tokenData.access_token;

    // Fetch GitHub user profile
    const ghUser = await httpsGet('https://api.github.com/user', {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Genesis.ai',
    });

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
      const redirectUrl = `${process.env.CLIENT_URL}/login?error=github_no_email`;
      return redirectWithOAuthLog(res, 'missing_email_redirect', redirectUrl);
    }

    const name = ghUser.name || ghUser.login;
    const githubId = String(ghUser.id);
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
        'UPDATE users SET github_id = $1, github_token = $2, avatar_url = $3, updated_at = NOW() WHERE id = $4',
        [githubId, accessToken, avatarUrl, user.id]
      );
    } else {
      // Create new user (no password needed for OAuth)
      const result = await db.query(
        'INSERT INTO users (name, email, github_id, github_token, avatar_url, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, email, githubId, accessToken, avatarUrl, 'GITHUB_OAUTH']
      );
      user = result.rows[0];
    }

    const token = generateToken(user);

    // Redirect to client with JWT token
    const redirectUrl = `${process.env.CLIENT_URL}/auth/github/callback?token=${token}`;
    return redirectWithOAuthLog(res, 'oauth_success_redirect', redirectUrl);
  } catch (err) {
    console.error('GitHub OAuth error:', err);
    const redirectUrl = `${process.env.CLIENT_URL}/login?error=github_failed`;
    return redirectWithOAuthLog(res, 'oauth_error_redirect', redirectUrl);
  }
};

export default {
  register,
  login,
  getMe,
  updateGithubToken,
  githubRedirect,
  githubCallback,
};
