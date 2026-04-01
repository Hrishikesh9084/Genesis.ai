import express from 'express';
import newsletterController from '../controllers/newsletterController.js';
import validators from '../middleware/validators.js';

const router = express.Router();

router.post('/subscribe', validators.validateNewsletterSubscription, newsletterController.subscribe);
router.get('/unsubscribe', newsletterController.unsubscribe);
router.post('/unsubscribe', newsletterController.unsubscribe);

export default router;
