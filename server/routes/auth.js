import express from 'express';
import authController from '../controllers/authController.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/github-token', authenticate, authController.updateGithubToken);

// GitHub OAuth
router.get('/github', authController.githubRedirect);
router.get('/callback/github', authController.githubCallback);

export default router;
