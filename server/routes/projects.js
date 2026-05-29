import express from 'express';
import projectController from '../controllers/projectController.js';
import authenticate from '../middleware/auth.js';
import validators from '../middleware/validators.js';

const router = express.Router();

router.get('/models', authenticate, projectController.getModels);

router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/:id', validators.validateProjectIdParam, projectController.getProject);
router.post('/', validators.validateCreateProject, projectController.createProject);
router.post('/:id/cancel', validators.validateProjectIdParam, projectController.cancelProject);
router.post('/:id/explain', validators.validateProjectIdParam, validators.validateExplainProject, projectController.explainProject);
router.put('/:id/edit', validators.validateProjectIdParam, validators.validateEditProject, projectController.editProject);
router.put('/:id/files', validators.validateProjectIdParam, validators.validateProjectFiles, projectController.updateProjectFiles);
router.delete('/:id', validators.validateProjectIdParam, projectController.deleteProject);
router.post('/:id/github', validators.validateProjectIdParam, validators.validateGithubPush, projectController.pushToGithub);

export default router;
