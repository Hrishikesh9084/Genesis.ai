const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static files (HTML, CSS, JS) from current directory
app.use(express.static(__dirname));

// API route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working' });
});

// Simple text endpoint
app.get('/api/simple', (req, res) => {
  res.send('Backend is working');
});

// Start server
app.listen(PORT, () => {
  console.log(`Test app server running on http://localhost:${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/test`);
});
