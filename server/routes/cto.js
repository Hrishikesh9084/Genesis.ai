import express from 'express';
import authenticate from '../middleware/auth.js';
import validators from '../middleware/validators.js';
import ctoController from '../controllers/ctoController.js';

const router = express.Router();

router.use(authenticate);

router.post('/analyze', validators.validateCtoAnalyze, ctoController.analyzeIdea);

export default router;