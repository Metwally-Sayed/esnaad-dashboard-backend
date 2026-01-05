import { Router } from 'express';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { getPresignedUrls, uploadFileDirect, uploadMiddleware } from '../controllers/upload.controller';

const router = Router();

// All upload routes require authentication
router.use(requireAuth);

// POST /uploads/r2/presign - Get presigned URLs for client-to-R2 upload
router.post('/r2/presign', getPresignedUrls);

// POST /uploads/r2/direct - Direct file upload via backend (bypasses presigned URL signature issues)
router.post('/r2/direct', uploadMiddleware, uploadFileDirect);

export default router;