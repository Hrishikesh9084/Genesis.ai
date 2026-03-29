import https from 'https';

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function resolveRenderOwnerId(apiKey) {
  if (process.env.RENDER_OWNER_ID) {
    return process.env.RENDER_OWNER_ID;
  }

  const ownersResponse = await httpsRequest({
    hostname: 'api.render.com',
    path: '/v1/owners',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (ownersResponse.statusCode >= 400) {
    throw new Error(`Unable to fetch Render workspaces: ${JSON.stringify(ownersResponse.data)}`);
  }

  const owners = ownersResponse.data?.owners || ownersResponse.data || [];
  const ownerId = Array.isArray(owners) ? owners[0]?.owner?.id || owners[0]?.id : owners?.id;

  if (!ownerId) {
    throw new Error(
      'Render workspace not found. Set RENDER_OWNER_ID or ensure the API key has access to at least one workspace.'
    );
  }

  return ownerId;
}

const deployToVercel = async (project) => {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('Vercel token not configured.');

  const parsedFiles = typeof project.files === 'string' ? JSON.parse(project.files) : project.files;

  const vercelFiles = Object.entries(parsedFiles).map(([filePath, content]) => ({
    file: filePath,
    data: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
  }));

  const projectName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  const deployPayload = {
    name: projectName,
    files: vercelFiles,
    projectSettings: {
      framework: 'vite',
      buildCommand: 'cd client && npm install && npm run build',
      outputDirectory: 'client/dist',
      installCommand: 'npm install',
    },
  };

  const response = await httpsRequest(
    {
      hostname: 'api.vercel.com',
      path: '/v13/deployments',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    deployPayload
  );

  if (response.statusCode >= 400) {
    throw new Error(`Vercel deployment failed: ${JSON.stringify(response.data)}`);
  }

  return {
    url: `https://${response.data.url}`,
    deployId: response.data.id,
  };
};

const deployToRender = async (project) => {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) throw new Error('Render API key not configured.');

  if (!project.github_repo_url) {
    throw new Error('Project must be pushed to GitHub before deploying to Render.');
  }

  const projectName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  const ownerId = await resolveRenderOwnerId(apiKey);

  const servicePayload = {
    type: 'web_service',
    name: projectName,
    ownerId,
    repo: project.github_repo_url,
    autoDeploy: 'yes',
    buildCommand: 'npm install',
    startCommand: 'npm start',
    rootDir: 'server',
    envVars: [
      { key: 'NODE_ENV', value: 'production' },
    ],
    plan: 'free',
    env: 'node',
  };

  const response = await httpsRequest(
    {
      hostname: 'api.render.com',
      path: '/v1/services',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    servicePayload
  );

  if (response.statusCode >= 400) {
    throw new Error(`Render deployment failed: ${JSON.stringify(response.data)}`);
  }

  const service = response.data.service || response.data;

  return {
    url: `https://${service.slug || projectName}.onrender.com`,
    deployId: service.id,
  };
};

export default {
  deployToVercel,
  deployToRender,
};
