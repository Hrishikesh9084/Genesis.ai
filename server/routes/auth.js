const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/github-token', authenticate, authController.updateGithubToken);

// GitHub OAuth
router.get('/github', authController.githubRedirect);
router.get('/callback/github', authController.githubCallback);

module.exports = router;
