import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarDir = path.join(__dirname, '../uploads/avatars');

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
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

export default {
  uploadAvatar,
  uploadAvatarImage,
};
