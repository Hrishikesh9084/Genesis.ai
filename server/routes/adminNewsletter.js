import express from 'express';
import adminNewsletterController from '../controllers/adminNewsletterController.js';
import authenticate from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate, requireAdmin);

// Newsletter Issues
router.get('/issues', adminNewsletterController.listIssues);
router.post('/issues', adminNewsletterController.createIssue);
router.get('/issues/:id', adminNewsletterController.getIssue);
router.put('/issues/:id', adminNewsletterController.updateIssue);
router.delete('/issues/:id', adminNewsletterController.deleteIssue);

// Newsletter Articles
router.post('/articles', adminNewsletterController.createArticle);
router.put('/articles/:id', adminNewsletterController.updateArticle);
router.delete('/articles/:id', adminNewsletterController.deleteArticle);

// Send Newsletter
router.post('/issues/:id/send', adminNewsletterController.sendIssue);

export default router;
