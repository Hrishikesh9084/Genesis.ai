import httpProxy from 'http-proxy';
import portManager from './portManager.js';

const BASE_DOMAIN = String(process.env.GENESIS_DEPLOY_BASE_DOMAIN || 'genesisapp.in').toLowerCase();

const proxy = httpProxy.createProxyServer({
  xfwd: true,
  changeOrigin: true,
  ws: true,
  secure: false,
  ignorePath: false,
});

function getHostWithoutPort(hostHeader) {
  return String(hostHeader || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function getSubdomainFromHost(hostname) {
  if (!hostname || hostname === BASE_DOMAIN) return null;
  if (!hostname.endsWith(`.${BASE_DOMAIN}`)) return null;

  const prefix = hostname.slice(0, hostname.length - BASE_DOMAIN.length - 1);
  if (!prefix || prefix.includes('.')) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(prefix)) return null;

  return prefix;
}

proxy.on('error', (error, req, res) => {
  if (res?.headersSent) return;
  res.writeHead(502, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      error: 'Deployment proxy error.',
      details: error.message,
    })
  );
});

async function handleWildcardSubdomain(req, res, next) {
  try {
    const host = getHostWithoutPort(req.headers.host);
    const subdomain = getSubdomainFromHost(host);

    if (!subdomain) {
      return next();
    }

    const mapping = await portManager.getMappingBySubdomain(subdomain);
    if (!mapping?.port) {
      return res.status(404).json({
        error: 'Project deployment not found for this subdomain.',
        subdomain,
      });
    }

    const target = `http://127.0.0.1:${mapping.port}`;
    proxy.web(req, res, { target });
    return;
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to route deployment request.',
        details: error.message,
      });
    }

    return next(error);
  }
}

export default {
  handleWildcardSubdomain,
};
