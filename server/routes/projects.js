const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authenticate = require('../middleware/auth');

router.get('/models', authenticate, projectController.getModels);

router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProject);
router.post('/', projectController.createProject);
router.put('/:id/edit', projectController.editProject);
router.put('/:id/files', projectController.updateProjectFiles);
router.delete('/:id', projectController.deleteProject);
router.post('/:id/github', projectController.pushToGithub);

module.exports = router;
