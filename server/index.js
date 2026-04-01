import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './config/db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import deployRoutes from './routes/deploy.js';
import paymentRoutes from './routes/payments.js';
import contactRoutes from './routes/contact.js';
import careersRoutes from './routes/careers.js';
import supportRoutes from './routes/support.js';
import newsletterRoutes from './routes/newsletter.js';
import adminNewsletterRoutes from './routes/adminNewsletter.js';
import newsletterService from './services/newsletterService.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const REQUEST_TIMEOUT_MS = Number.parseInt(String(process.env.REQUEST_TIMEOUT_MS || '30000'), 10);

// Required when running behind a reverse proxy (Vercel/Render/Nginx) so req.ip is derived correctly.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
}));
app.use(compression());
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));

app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT_MS);
  res.setTimeout(REQUEST_TIMEOUT_MS);
  next();
});

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
app.use('/api/payments', paymentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/admin/newsletter', adminNewsletterRoutes);

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

const server = app.listen(PORT, () => {
  console.log(`Genesis.ai server running on port ${PORT}`);
  newsletterService.startNewsletterScheduler();
});

async function shutdown(signal) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    try {
      await db.pool.end();
      console.log('Database pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('Failed to close database pool cleanly:', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
