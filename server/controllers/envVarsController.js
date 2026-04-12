import db from '../config/db.js';

let ensureEnvVarsSchemaPromise;

function ensureEnvVarsSchema() {
  if (!ensureEnvVarsSchemaPromise) {
    ensureEnvVarsSchemaPromise = db
      .query(`
        CREATE TABLE IF NOT EXISTS deployment_env_vars (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key VARCHAR(255) NOT NULL,
          value TEXT NOT NULL DEFAULT '',
          is_secret BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(project_id, key)
        );
        CREATE INDEX IF NOT EXISTS idx_env_vars_project_id ON deployment_env_vars(project_id);
      `)
      .catch((err) => {
        ensureEnvVarsSchemaPromise = null;
        throw err;
      });
  }
  return ensureEnvVarsSchemaPromise;
}

function maskValue(value, isSecret) {
  if (!isSecret || !value) return value;
  if (value.length <= 4) return '••••';
  return '••••' + value.slice(-4);
}

const getEnvVars = async (req, res, next) => {
  try {
    await ensureEnvVarsSchema();
    const { id } = req.params;

    const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (projectCheck.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

    const result = await db.query(
      'SELECT id, key, value, is_secret, created_at, updated_at FROM deployment_env_vars WHERE project_id = $1 AND user_id = $2 ORDER BY key ASC',
      [id, req.user.id]
    );

    const vars = result.rows.map((row) => ({
      ...row,
      value: maskValue(row.value, row.is_secret),
    }));

    res.json({ envVars: vars });
  } catch (err) {
    next(err);
  }
};

const setEnvVars = async (req, res, next) => {
  try {
    await ensureEnvVarsSchema();
    const { id } = req.params;
    const { vars } = req.body || {};

    if (!Array.isArray(vars) || vars.length === 0) {
      return res.status(400).json({ error: 'vars must be a non-empty array of { key, value, isSecret? } objects.' });
    }

    const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (projectCheck.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

    const results = [];
    for (const v of vars) {
      const key = String(v.key || '').trim().toUpperCase();
      const value = String(v.value ?? '');
      const isSecret = Boolean(v.isSecret);

      if (!key || !/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        results.push({ key: v.key, error: 'Invalid key format. Use UPPER_SNAKE_CASE.' });
        continue;
      }

      const result = await db.query(
        `INSERT INTO deployment_env_vars (project_id, user_id, key, value, is_secret)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, key)
         DO UPDATE SET value = EXCLUDED.value, is_secret = EXCLUDED.is_secret, updated_at = NOW()
         RETURNING id, key, is_secret, created_at, updated_at`,
        [id, req.user.id, key, value, isSecret]
      );

      results.push({ ...result.rows[0], value: maskValue(value, isSecret) });
    }

    res.json({ envVars: results });
  } catch (err) {
    next(err);
  }
};

const deleteEnvVar = async (req, res, next) => {
  try {
    await ensureEnvVarsSchema();
    const { id, key } = req.params;

    const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (projectCheck.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

    const result = await db.query(
      'DELETE FROM deployment_env_vars WHERE project_id = $1 AND user_id = $2 AND key = $3 RETURNING id',
      [id, req.user.id, key.toUpperCase()]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Environment variable not found.' });

    res.json({ success: true, deletedKey: key.toUpperCase() });
  } catch (err) {
    next(err);
  }
};

const getEnvVarsRaw = async (projectId, userId) => {
  try {
    await ensureEnvVarsSchema();
    const result = await db.query(
      'SELECT key, value FROM deployment_env_vars WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    const envMap = {};
    for (const row of result.rows) {
      envMap[row.key] = row.value;
    }
    return envMap;
  } catch {
    return {};
  }
};

export { getEnvVarsRaw };
export default { getEnvVars, setEnvVars, deleteEnvVar, getEnvVarsRaw };
