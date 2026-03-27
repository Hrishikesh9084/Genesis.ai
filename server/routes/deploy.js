import express from 'express';
import deployController from '../controllers/deployController.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/:id', deployController.deployProject);
router.get('/:id/deployments', deployController.getDeployments);
router.get('/status/:deployId', deployController.getDeploymentStatus);

export default router;
