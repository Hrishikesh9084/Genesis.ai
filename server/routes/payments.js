import express from 'express';
import paymentController from '../controllers/paymentController.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

router.get('/plans', paymentController.getPlans);

router.use(authenticate);

router.get('/balance', paymentController.getBalance);
router.post('/order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);

export default router;
