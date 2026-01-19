import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { getPresignedUrls, uploadFileDirect, uploadMiddleware } from '../controllers/upload.controller';
import multer from 'multer';

const router = Router();

// All upload routes require authentication
router.use(requireAuth);

// Wrapper to handle multer errors properly
const uploadWithErrorHandling = (req: Request, res: Response, next: NextFunction): void => {
  uploadMiddleware(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          error: 'File is too large. Maximum size is 10MB.'
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`
      });
      return;
    }
    if (err) {
      res.status(400).json({
        success: false,
        error: err.message || 'Upload failed'
      });
      return;
    }
    next();
  });
};

// POST /uploads/r2/presign - Get presigned URLs for client-to-R2 upload
router.post('/r2/presign', getPresignedUrls);

// POST /uploads/r2/direct - Direct file upload via backend to R2 (deprecated, for backward compatibility)
router.post('/r2/direct', uploadWithErrorHandling, uploadFileDirect);

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
router.post('/cloudinary/direct', uploadWithErrorHandling, uploadFileDirect);

export default router;