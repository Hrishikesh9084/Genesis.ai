import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /tmp on serverless (Lambda, etc.), otherwise use local uploads directory
const isServerless = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL || process.env.NODE_ENV === 'serverless';
const baseDir = isServerless ? '/tmp' : path.join(__dirname, '../uploads');
const avatarDir = path.join(baseDir, 'avatars');
const resumeDir = path.join(baseDir, 'resumes');

// Create directories if they don't exist (will work on /tmp)
try {
  if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
  }
  if (!fs.existsSync(resumeDir)) {
    fs.mkdirSync(resumeDir, { recursive: true });
  }
} catch (err) {
  console.warn('Warning: Could not create upload directories:', err.message);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const safeBase = path
      .parse(file.originalname)
      .name
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40) || 'avatar';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${req.user.id}-${safeBase}-${unique}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!file.mimetype?.startsWith('image/')) {
    cb(new Error('Only image files are allowed.'));
    return;
  }
  cb(null, true);
}

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, resumeDir);
  },
  filename: (_req, file, cb) => {
    const safeBase = path
      .parse(file.originalname)
      .name
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 60) || 'resume';
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${safeBase}-${unique}${ext}`);
  },
});

function resumeFileFilter(_req, file, cb) {
  const allowedMimeTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);

  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExt = new Set(['.pdf', '.doc', '.docx']);

  if (!allowedMimeTypes.has(String(file.mimetype || '').toLowerCase()) && !allowedExt.has(ext)) {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed.'));
    return;
  }

  cb(null, true);
}

const uploadResume = multer({
  storage: resumeStorage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const uploadAvatarImage = (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      err.status = 400;
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.message = 'Image must be smaller than 5MB.';
      }
      return next(err);
    }
    return next();
  });
};

const uploadResumeFile = (req, res, next) => {
  uploadResume.single('resume')(req, res, (err) => {
    if (err) {
      err.status = 400;
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.message = 'Resume file must be smaller than 8MB.';
      }
      return next(err);
    }
    return next();
  });
};

export default {
  uploadAvatar,
  uploadAvatarImage,
  uploadResume,
  uploadResumeFile,
  resumeDir,
};
