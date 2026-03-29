# GitHub OAuth Setup Guide

If you're seeing the error:
```
The redirect_uri is not associated with this application.
The application might be misconfigured or could be trying to redirect you to a website you weren't expecting.
```

This means the redirect URI your Genesis.ai server is using doesn't match what's configured in your GitHub OAuth application.

## Step 1: Create or Update Your GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "Developer settings" → "OAuth Apps"
3. Click "New OAuth App" (or edit an existing one)

## Step 2: Configure the OAuth App

Fill in the following fields:

| Field | Value |
|-------|-------|
| **Application name** | Genesis AI |
| **Homepage URL** | `http://localhost:5173` (or your production frontend URL) |
| **Application description** | AI code generation platform |
| **Authorization callback URL** | `http://localhost:5000/api/auth/callback/github` |

### Important: The Authorization callback URL must match your backend

- **For local development**: `http://localhost:5000/api/auth/callback/github`
- **For production**: `https://yourdomain.com/api/auth/callback/github`

> ⚠️ **CRITICAL**: The callback URL must be EXACTLY as configured in your GitHub app settings. Even a trailing slash difference will cause authentication to fail.

## Step 3: Update Your Environment Variables

After creating the OAuth app:

1. Copy your **Client ID** and **Client Secret** from GitHub
2. Update your `.env` file:

```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:5000/api/auth/callback/github
```

## Step 4: Restart Your Server

After updating `.env`, restart the backend server:

```bash
cd server
npm run dev
```

## Troubleshooting

### Check the Server Logs

When you click "Sign in with GitHub", the server will log the redirect URI it's using:

```
[GitHub OAuth] Initiating GitHub login
[GitHub OAuth] Redirect URI: http://localhost:5000/api/auth/callback/github
[GitHub OAuth] Client ID: xxxxx****
```

**The Redirect URI in the logs must match exactly what you configured in your GitHub OAuth app.**

### Common Issues

| Issue | Solution |
|-------|----------|
| `redirect_uri is not associated` | Ensure the callback URL in GitHub OAuth app matches exactly (check for trailing slashes, protocol, domain) |
| `client_id or client_secret is invalid` | Verify you copied the correct values from GitHub app settings |
| Login redirects to error page | Check browser console for error messages and server logs for details |
| Works locally but not in production | Update `GITHUB_REDIRECT_URI` to match your production domain: `https://yourdomain.com/api/auth/callback/github` |

### Network/Proxy Issues

If your server is behind a proxy or load balancer:

1. Ensure `X-Forwarded-Proto` and `X-Forwarded-Host` headers are being set correctly
2. Or explicitly set `GITHUB_REDIRECT_URI` in `.env` to bypass auto-detection:

```bash
GITHUB_REDIRECT_URI=https://yourdomain.com/api/auth/callback/github
```

## Production Deployment

For production:

1. Create a new OAuth app in GitHub for your production domain
2. Set `Homepage URL` to `https://yourdomain.com`
3. Set `Authorization callback URL` to `https://yourdomain.com/api/auth/callback/github`
4. Update `.env` with production values:

```bash
GITHUB_CLIENT_ID=your-production-client-id
GITHUB_CLIENT_SECRET=your-production-client-secret
GITHUB_REDIRECT_URI=https://yourdomain.com/api/auth/callback/github
```

## Getting Help

If you're still having issues:

1. Check the server console logs for the redirect URI being used
2. Verify it matches your GitHub OAuth app settings exactly
3. Ensure your `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct
4. Make sure your server is accessible at the URL you configured
