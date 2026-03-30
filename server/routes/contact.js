import express from 'express';
import contactController from '../controllers/contactController.js';
import validators from '../middleware/validators.js';

const router = express.Router();

router.post('/', validators.validateContactSubmission, contactController.submitContact);

export default router;
