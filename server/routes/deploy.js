import express from 'express';
import router from express.Router();
import deployController from '../controllers/deployController.js';
import authenticate from '../middleware/auth.js';

router.use(authenticate);

router.post('/:id', deployController.deployProject);
router.get('/:id/deployments', deployController.getDeployments);
router.get('/status/:deployId', deployController.getDeploymentStatus);

module.exports = router;
