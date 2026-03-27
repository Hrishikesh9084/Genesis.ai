import express from 'express';
import previewController from '../controllers/previewController.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/:id/start', previewController.startPreview);
router.post('/:id/stop', previewController.stopPreview);
router.get('/:id/status', previewController.getPreviewStatus);

export default router;
