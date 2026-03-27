import db from '../config/db.js';
import previewRunner from '../services/previewRunner.js';

const startPreview = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = result.rows[0];

    if (!project.files || Object.keys(typeof project.files === 'string' ? JSON.parse(project.files) : project.files).length === 0) {
      return res.status(400).json({ error: 'Project has no files to preview.' });
    }

    // Start preview async — return immediately so client can poll
    previewRunner.startPreview(id, project.files).catch((err) => {
      console.error('Preview start error:', err.message);
    });

    const status = previewRunner.getStatus(id);
    res.json(status);
  } catch (err) {
    next(err);
  }
};

const stopPreview = async (req, res, next) => {
  try {
    await previewRunner.stopPreview(req.params.id);
    res.json({ status: 'stopped' });
  } catch (err) {
    next(err);
  }
};

const getPreviewStatus = (req, res) => {
  const status = previewRunner.getStatus(req.params.id);
  res.json(status);
};

export default {
  startPreview,
  stopPreview,
  getPreviewStatus,
};
