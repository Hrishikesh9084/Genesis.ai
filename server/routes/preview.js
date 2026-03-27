import express from ('express');
import router from express.Router();
import previewController from ('../controllers/previewController');
import authenticate from ('../middleware/auth');

router.use(authenticate);

router.post('/:id/start', previewController.startPreview);
router.post('/:id/stop', previewController.stopPreview);
router.get('/:id/status', previewController.getPreviewStatus);

module.exports = router;
