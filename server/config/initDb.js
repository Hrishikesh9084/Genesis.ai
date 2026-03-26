const fs = require('fs');
const path = require('path');
const db = require('./db');

async function initDatabase() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    await db.query(sql);
    console.log('Database initialized successfully');
    process.exit(0);
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
}

initDatabase();
