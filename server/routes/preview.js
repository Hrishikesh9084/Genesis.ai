import express from 'express';
import previewController from '../controllers/previewController.js';
import authenticate from '../middleware/auth.js';
import validators from '../middleware/validators.js';

const router = express.Router();

router.use(authenticate);

router.post('/:id/start', validators.validateProjectIdParam, previewController.startPreview);
router.post('/:id/stop', validators.validateProjectIdParam, previewController.stopPreview);
router.get('/:id/status', validators.validateProjectIdParam, previewController.getPreviewStatus);

export default router;
