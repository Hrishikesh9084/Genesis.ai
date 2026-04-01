import express from 'express';
import supportController from '../controllers/supportController.js';

const router = express.Router();

router.post('/chat', supportController.chat);

export default router;
