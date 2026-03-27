import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import deployRoutes from './routes/deploy';
import previewRoutes from './routes/preview';
import errorHandler from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/preview', previewRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found.' });
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Genesis.ai server running on port ${PORT}`);
});

module.exports = app;
