import db from '../config/db.js';
import deployService from '../services/deployService.js';

const deployProject = async (req, res, next) => {
  try {
    const { platform } = req.body;
    const { id } = req.params;

    if (!['vercel', 'render'].includes(platform)) {
      return res.status(400).json({ error: 'Platform must be "vercel" or "render".' });
    }

    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projectResult.rows[0];

    if (project.status !== 'ready') {
      return res.status(400).json({ error: 'Project is not ready for deployment.' });
    }

    if (!project.github_repo_url) {
      return res.status(400).json({ error: 'Push code to GitHub before deploying.' });
    }

    const deployResult = await db.query(
      'INSERT INTO deployments (project_id, platform, status) VALUES ($1, $2, $3) RETURNING *',
      [id, platform, 'deploying']
    );

    const deployment = deployResult.rows[0];

    deployAsync(deployment.id, project, platform);

    res.json({ deployment });
  } catch (err) {
    next(err);
  }
};

async function deployAsync(deploymentId, project, platform) {
  try {
    let result;

    if (platform === 'vercel') {
      result = await deployService.deployToVercel(project);
    } else {
      result = await deployService.deployToRender(project);
    }

    await db.query(
      'UPDATE deployments SET status = $1, url = $2, deploy_id = $3, updated_at = NOW() WHERE id = $4',
      ['deployed', result.url, result.deployId, deploymentId]
    );

    await db.query(
      'UPDATE projects SET deploy_url = $1, deploy_platform = $2, status = $3, updated_at = NOW() WHERE id = $4',
      [result.url, platform, 'deployed', project.id]
    );
  } catch (err) {
    console.error('Deployment failed:', err);
    await db.query(
      'UPDATE deployments SET status = $1, logs = $2, updated_at = NOW() WHERE id = $3',
      ['failed', err.message, deploymentId]
    );
  }
}

const getDeployments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const result = await db.query(
      'SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({ deployments: result.rows });
  } catch (err) {
    next(err);
  }
};

const getDeploymentStatus = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM deployments WHERE id = $1', [req.params.deployId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deployment not found.' });
    }

    res.json({ deployment: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

export default {
  deployProject,
  getDeployments,
  getDeploymentStatus,
};
