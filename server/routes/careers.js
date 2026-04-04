import express from 'express';
import rateLimit from 'express-rate-limit';
import careersController from '../controllers/careersController.js';
import mockInterviewController from '../controllers/mockInterviewController.js';
import validators from '../middleware/validators.js';
import authenticate from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';
import upload from '../middleware/upload.js';

const router = express.Router();

const applyLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many job applications from this IP. Please try again later.' },
});

const statusLookupLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many status checks from this IP. Please try again later.' },
});

const mockInterviewLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many interview requests from this IP. Please try again later.' },
});

router.get('/jobs', careersController.getJobs);
router.post('/apply', applyLimiter, upload.uploadResumeFile, validators.validateCareerApplication, careersController.applyForJob);
router.post('/status', statusLookupLimiter, validators.validateApplicationStatusLookup, careersController.getApplicationStatus);
router.post(
	'/mock-interview/suggest-role',
	mockInterviewLimiter,
	upload.uploadResumeFile,
	validators.validateSuggestMockInterviewRole,
	mockInterviewController.suggestMockInterviewRole
);
router.post(
	'/mock-interview/start',
	mockInterviewLimiter,
	upload.uploadResumeFile,
	validators.validateStartMockInterview,
	mockInterviewController.startMockInterview
);
router.post(
	'/mock-interview/answer',
	mockInterviewLimiter,
	validators.validateMockInterviewAnswer,
	mockInterviewController.answerMockInterviewQuestion
);

router.use('/admin', authenticate, requireAdmin);
router.get('/admin/jobs', careersController.listJobRoles);
router.post('/admin/jobs', validators.validateAdminCreateJobRole, careersController.createJobRole);
router.put('/admin/jobs/:id', validators.validateJobRoleIdParam, validators.validateAdminUpdateJobRole, careersController.updateJobRole);
router.delete('/admin/jobs/:id', validators.validateJobRoleIdParam, careersController.deleteJobRole);
router.get('/admin/applications', careersController.listApplications);
router.patch(
	'/admin/applications/:id/status',
	validators.validateApplicationIdParam,
	validators.validateApplicationStatusUpdate,
	careersController.updateApplicationStatus
);
router.delete(
	'/admin/applications/:id',
	validators.validateApplicationIdParam,
	careersController.deleteApplication
);
router.get(
	'/admin/applications/:id/resume',
	validators.validateApplicationIdParam,
	careersController.downloadApplicationResume
);

export default router;
