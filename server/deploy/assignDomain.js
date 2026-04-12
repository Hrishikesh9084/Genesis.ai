function vercelBaseUrl() {
  return (process.env.VERCEL_API_BASE_URL || 'https://api.vercel.com').replace(/\/+$/, '');
}

async function callVercel(path, token, method = 'GET', body) {
  const response = await fetch(`${vercelBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Vercel API failed (${response.status}).`);
  }

  return data;
}

export async function assignSubdomain({ projectName, projectId, logger }) {
  const token = process.env.VERCEL_TOKEN;
  const baseDomain = process.env.GENESIS_DEPLOY_BASE_DOMAIN || 'genesisapp.in';
  const teamId = process.env.VERCEL_TEAM_ID || undefined;

  if (!token) {
    throw new Error('VERCEL_TOKEN is required for domain assignment.');
  }

  const safeSubdomain = String(projectName || 'app')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const subdomain = `${safeSubdomain}.${baseDomain}`;
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

  await logger.info('Assigning custom subdomain.', { subdomain, projectId });
  await callVercel(`/v10/projects/${encodeURIComponent(projectId)}/domains${qs}`, token, 'POST', {
    name: subdomain,
  });

  // Vercel provisions SSL asynchronously after domain attachment and DNS validation.
  await logger.info('Custom subdomain assigned. SSL provisioning in progress.', { subdomain });

  return {
    subdomain,
    url: `https://${subdomain}`,
  };
}
