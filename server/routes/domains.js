import express from 'express';
import authenticate from '../middleware/auth.js';
import domainsController from '../controllers/domainsController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', domainsController.listDomains);
router.post('/reassign', domainsController.reassignSubdomain);
router.post('/release', domainsController.releaseSubdomain);
router.post('/custom/connect', domainsController.connectCustomDomain);
router.post('/custom/verify', domainsController.verifyCustomDomain);

export default router;
