import express from 'express';
import projectController from '../controllers/projectController.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

router.get('/models', authenticate, projectController.getModels);

router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProject);
router.post('/', projectController.createProject);
router.put('/:id/edit', projectController.editProject);
router.put('/:id/files', projectController.updateProjectFiles);
router.delete('/:id', projectController.deleteProject);
router.post('/:id/github', projectController.pushToGithub);

export default router;
