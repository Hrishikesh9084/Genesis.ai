import express from 'express';
import router from express.Router();
import deployController from '../controllers/deployController';
import authenticate from '../middleware/auth';

router.use(authenticate);

router.post('/:id', deployController.deployProject);
router.get('/:id/deployments', deployController.getDeployments);
router.get('/status/:deployId', deployController.getDeploymentStatus);

module.exports = router;
