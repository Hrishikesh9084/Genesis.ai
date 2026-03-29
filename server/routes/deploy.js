import express from 'express';
import deployController from '../controllers/deployController.js';
import authenticate from '../middleware/auth.js';
import validators from '../middleware/validators.js';

const router = express.Router();

router.use(authenticate);

router.post('/:id', validators.validateProjectIdParam, validators.validateDeployBody, deployController.deployProject);
router.get('/:id/deployments', validators.validateProjectIdParam, deployController.getDeployments);
router.get('/status/:deployId', validators.validateDeployIdParam, deployController.getDeploymentStatus);

export default router;
