import { Router } from 'express';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { getPresignedUrls, uploadFileDirect, uploadMiddleware } from '../controllers/upload.controller';

const router = Router();

// All upload routes require authentication
router.use(requireAuth);

// POST /uploads/r2/presign - Get presigned URLs for client-to-R2 upload
router.post('/r2/presign', getPresignedUrls);

// POST /uploads/r2/direct - Direct file upload via backend to R2 (deprecated, for backward compatibility)
router.post('/r2/direct', uploadMiddleware, uploadFileDirect);

/**
 * POST /uploads/cloudinary/direct
 * Direct file upload to Cloudinary via backend
 * Used by: ImageUploader component for snagging images
 *
 * Request:
 *   - Content-Type: multipart/form-data
 *   - Field: 'file' (File object)
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "publicUrl": "https://...",      // Cloudinary secure_url
 *       "key": "public_id",               // Cloudinary public_id
 *       "fileName": "...",
 *       "mimeType": "image/...",
 *       "sizeBytes": 12345
 *     }
 *   }
 */
router.post('/cloudinary/direct', uploadMiddleware, uploadFileDirect);

export default router;