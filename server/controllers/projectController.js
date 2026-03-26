const db = require('../config/db');
const aiGenerator = require('../services/aiGenerator');
const githubService = require('../services/githubService');

exports.getModels = (req, res) => {
  res.json({
    providers: aiGenerator.getAvailableModels(),
    default: aiGenerator.DEFAULT_MODEL,
  });
};

exports.getProjects = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, prompt, stack, status, github_repo_url, deploy_url, deploy_platform, created_at, updated_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    next(err);
  }
};

exports.getProject = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const { name, prompt, stack, model } = req.body;

    if (!name || !prompt) {
      return res.status(400).json({ error: 'Name and prompt are required.' });
    }

    const selectedModel = model || aiGenerator.DEFAULT_MODEL;

    const result = await db.query(
      'INSERT INTO projects (user_id, name, prompt, stack, model, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, name, prompt, stack || 'react-express', selectedModel, 'generating']
    );

    const project = result.rows[0];

    generateProjectAsync(project.id, prompt, stack || 'react-express', selectedModel);

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
};

async function generateProjectAsync(projectId, prompt, stack, modelName) {
  try {
    const files = await aiGenerator.generateProject(prompt, stack, modelName);

    await db.query('UPDATE projects SET files = $1, status = $2, updated_at = NOW() WHERE id = $3', [
      JSON.stringify(files),
      'ready',
      projectId,
    ]);
  } catch (err) {
    console.error('Project generation failed:', err);
    await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', [
      'error',
      projectId,
    ]);
  }
}

exports.editProject = async (req, res, next) => {
  try {
    const { prompt: editPrompt, model } = req.body;
    const { id } = req.params;

    const result = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = result.rows[0];
    const selectedModel = model || project.model || aiGenerator.DEFAULT_MODEL;

    await db.query('UPDATE projects SET status = $1, model = $2, updated_at = NOW() WHERE id = $3', [
      'generating',
      selectedModel,
      id,
    ]);

    editProjectAsync(id, project.files, project.prompt, editPrompt, project.stack, selectedModel);

    res.json({ message: 'Project edit started.', projectId: id });
  } catch (err) {
    next(err);
  }
};

async function editProjectAsync(projectId, currentFiles, originalPrompt, editPrompt, stack, modelName) {
  try {
    const files = await aiGenerator.editProject(currentFiles, originalPrompt, editPrompt, stack, modelName);

    await db.query(
      'UPDATE projects SET files = $1, status = $2, prompt = $3, updated_at = NOW() WHERE id = $4',
      [JSON.stringify(files), 'ready', `${originalPrompt}\n\n[Edit]: ${editPrompt}`, projectId]
    );
  } catch (err) {
    console.error('Project edit failed:', err);
    await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', [
      'ready',
      projectId,
    ]);
  }
}

exports.updateProjectFiles = async (req, res, next) => {
  try {
    const { files } = req.body;
    const { id } = req.params;

    const result = await db.query(
      'UPDATE projects SET files = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [JSON.stringify(files), id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ message: 'Project deleted.' });
  } catch (err) {
    next(err);
  }
};

exports.pushToGithub = async (req, res, next) => {
  try {
    const { repoName, isPrivate } = req.body;
    const { id } = req.params;

    const userResult = await db.query('SELECT github_token FROM users WHERE id = $1', [req.user.id]);
    const githubToken = userResult.rows[0]?.github_token;

    if (!githubToken) {
      return res.status(400).json({ error: 'GitHub token not configured. Go to Settings to add it.' });
    }

    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projectResult.rows[0];
    const repoUrl = await githubService.createAndPushRepo(
      githubToken,
      repoName || project.name,
      project.files,
      isPrivate
    );

    await db.query('UPDATE projects SET github_repo_url = $1, updated_at = NOW() WHERE id = $2', [
      repoUrl,
      id,
    ]);

    res.json({ repoUrl });
  } catch (err) {
    next(err);
  }
};
