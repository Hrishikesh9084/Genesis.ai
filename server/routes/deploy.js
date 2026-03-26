const express = require('express');
const router = express.Router();
const deployController = require('../controllers/deployController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.post('/:id', deployController.deployProject);
router.get('/:id/deployments', deployController.getDeployments);
router.get('/status/:deployId', deployController.getDeploymentStatus);

module.exports = router;
