import { Request, Response, NextFunction } from 'express';
import { R2UploadService } from '../services/r2-upload.service';
import { successResponse } from '../../../common/utils/response';
import { z } from 'zod';

const r2UploadService = new R2UploadService();

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
export const getPresignedUrls = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate request
    const validation = presignSchema.safeParse(req);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.issues[0].message
      });
      return;
    }

    const { files } = validation.data.body;
    const userId = req.user!.id;

    const urls = await r2UploadService.getPresignedUploadUrls(files, userId);

    res.json(successResponse({
      uploads: urls,
      instructions: {
        method: 'PUT',
        headers: {
          'Content-Type': 'File MIME type'
        },
        body: 'Binary file data'
      }
    }, 'Presigned URLs generated successfully'));
  } catch (error) {
    next(error);
  }
};