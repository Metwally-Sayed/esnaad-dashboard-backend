import { Router } from 'express';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { getPresignedUrls } from '../controllers/upload.controller';

const router = Router();

// All upload routes require authentication
router.use(requireAuth);

// POST /uploads/r2/presign
router.post('/r2/presign', getPresignedUrls);

export default router;