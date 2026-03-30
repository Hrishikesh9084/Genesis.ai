import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import deployRoutes from './routes/deploy.js';
import previewRoutes from './routes/preview.js';
import contactRoutes from './routes/contact.js';
import careersRoutes from './routes/careers.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Required when running behind a reverse proxy (Vercel/Render/Nginx) so req.ip is derived correctly.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
}));
app.use(express.json({ limit: '50mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Genesis.ai API is healthy' });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Genesis.ai API is running' });
});

app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars')));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/careers', careersRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found.' });
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Genesis.ai server running on port ${PORT}`);
});

export default app;
