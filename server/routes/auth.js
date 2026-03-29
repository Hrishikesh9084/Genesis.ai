import express from 'express';
import authController from '../controllers/authController.js';
import authenticate from '../middleware/auth.js';
import validators from '../middleware/validators.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.post('/register', validators.validateRegister, authController.register);
router.post('/login', validators.validateLogin, authController.login);
router.get('/verify-email', validators.validateVerifyEmail, authController.verifyEmail);
router.post('/verify-email', validators.validateVerifyEmail, authController.verifyEmail);
router.post('/resend-verification', validators.validateResendVerification, authController.resendVerificationEmail);
router.post('/forgot-password', validators.validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', validators.validateResetPassword, authController.resetPassword);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, validators.validateUpdateProfile, authController.updateProfile);
router.post('/profile-image', authenticate, upload.uploadAvatarImage, authController.uploadProfileImage);
router.put('/github-token', authenticate, authController.updateGithubToken);

// GitHub OAuth
router.get('/github', authController.githubRedirect);
router.get('/callback/github', authController.githubCallback);
router.get('/google', authController.googleRedirect);
router.get('/callback/google', authController.googleCallback);

export default router;
