import { Request, Response, NextFunction } from 'express';
import { CloudinaryUploadService } from '../services/cloudinary-upload.service';
import { successResponse } from '../../../common/utils/response';
import { z } from 'zod';
import multer from 'multer';

const cloudinaryUploadService = new CloudinaryUploadService();

// Schema for presigned URL request
const presignSchema = z.object({
  body: z.object({
    files: z.array(z.object({
      fileName: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number().positive()
    })).min(1).max(10) // Max 10 files at once
  })
});

// Get presigned URLs for uploading files
// NOTE: This function is deprecated - we're using direct Cloudinary upload instead
export const getPresignedUrls = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(501).json({
      success: false,
      error: 'Presigned URL upload is deprecated. Use direct upload endpoint instead.'
    });
  } catch (error) {
    next(error);
  }
};

// Configure multer for in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed'));
    }
  }
});

// Export multer middleware for direct upload route
export const uploadMiddleware = upload.single('file');

// Direct upload to Cloudinary
export const uploadFileDirect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
      return;
    }

    const userId = req.user!.id;

    console.log('🔵 Upload Controller - Starting upload process');
    console.log('  User ID:', userId);
    console.log('  File name:', req.file.originalname);
    console.log('  MIME type:', req.file.mimetype);
    console.log('  File size:', req.file.size);

    const result = await cloudinaryUploadService.uploadFileDirectly({
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      userId
    });

    console.log('🟢 Upload Controller - Upload completed');
    console.log('  Public URL from Cloudinary:', result.publicUrl);
    console.log('  Key (public_id):', result.key);

    const response = {
      publicUrl: result.publicUrl,
      key: result.key,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size
    };

    console.log('🟢 Upload Controller - Sending response to client:');
    console.log(JSON.stringify(response, null, 2));

    res.json(successResponse(response, 'File uploaded successfully'));
  } catch (error) {
    console.error('🔴 Upload Controller - Error:', error);
    next(error);
  }
};