import  express from ('express');
import  router from express.Router();
import  authController from ('../controllers/authController');
import  authenticate from ('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/github-token', authenticate, authController.updateGithubToken);

// GitHub OAuth
router.get('/github', authController.githubRedirect);
router.get('/callback/github', authController.githubCallback);

module.exports = router;
