import express from 'express';
import deployController from '../controllers/deployController.js';
import envVarsController from '../controllers/envVarsController.js';
import authenticate from '../middleware/auth.js';
import validators from '../middleware/validators.js';

const router = express.Router();

router.use(authenticate);

router.post('/deploy', deployController.deployManaged);
router.get('/status/:deployId', validators.validateDeployIdParam, deployController.getDeploymentStatus);
router.get('/logs/stream/:deployId', validators.validateDeployIdParam, deployController.streamDeploymentLogs);
router.get('/logs/:deployId', validators.validateDeployIdParam, deployController.getDeploymentLogs);
router.post('/stop/:deployId', validators.validateDeployIdParam, deployController.stopDeployment);
router.post('/redeploy/:id', validators.validateProjectIdParam, deployController.redeployManaged);
router.post('/:id', validators.validateProjectIdParam, validators.validateDeployBody, deployController.deployProject);
router.get('/:id/deployments', validators.validateProjectIdParam, deployController.getDeployments);

// Environment Variables
router.get('/:id/env', validators.validateProjectIdParam, envVarsController.getEnvVars);
router.put('/:id/env', validators.validateProjectIdParam, envVarsController.setEnvVars);
router.delete('/:id/env/:key', validators.validateProjectIdParam, envVarsController.deleteEnvVar);

export default router;