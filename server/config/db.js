import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

const schemaReady = pool
  .query(
    `ALTER TABLE IF EXISTS projects
     ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'gemini-2.5-flash'`
  )
  .catch((err) => {
    console.error('Schema migration failed:', err.message);
    throw err;
  });

const db = {
  query: async (text, params) => {
    await schemaReady;
    return pool.query(text, params);
  },
  pool,
};

export default db;
