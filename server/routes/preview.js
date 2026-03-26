const express = require('express');
const router = express.Router();
const previewController = require('../controllers/previewController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.post('/:id/start', previewController.startPreview);
router.post('/:id/stop', previewController.stopPreview);
router.get('/:id/status', previewController.getPreviewStatus);

module.exports = router;
