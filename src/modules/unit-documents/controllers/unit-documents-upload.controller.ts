import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../../common/utils/response';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import { ValidationError } from '../../../common/errors';

const presignDocumentSchema = z.object({
  body: z.object({
    fileName: z.string().min(1),
    mimeType: z.literal('application/pdf').refine(
      (val) => val === 'application/pdf',
      { message: 'Only PDF files are allowed' }
    ),
    sizeBytes: z.number().positive().max(10 * 1024 * 1024, {
      message: 'File size must not exceed 10MB'
    })
  })
});

export class UnitDocumentsUploadController {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private publicUrl: string;
  private isConfigured: boolean = false;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    this.isConfigured = !!(accountId && accessKeyId && secretAccessKey);

    if (!this.isConfigured) {
      console.warn('⚠️  R2 upload disabled: R2 credentials not configured');
      this.bucketName = 'esnaad-dashboard';
      this.publicUrl = 'https://placeholder.r2.dev';
      return;
    }

    this.bucketName = process.env.R2_BUCKET || 'esnaad-dashboard';
    this.publicUrl = process.env.R2_PUBLIC_URL || `https://pub-${accountId}.r2.dev`;

    // Use public R2 domain for CORS-compatible presigned URLs
    const usePublicDomain = process.env.R2_USE_PUBLIC_DOMAIN === 'true';
    const endpoint = usePublicDomain
      ? this.publicUrl
      : `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!
      }
    });
  }

  getPresignedUploadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request
      const validation = presignDocumentSchema.safeParse(req);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const { fileName, mimeType, sizeBytes } = validation.data.body;
      const userId = req.user!.id;

      // Return mock URLs if R2 not configured
      if (!this.isConfigured) {
        const mockKey = `unit-documents/${userId}/${Date.now()}_${nanoid(12)}.pdf`;
        res.json(successResponse({
          presignedUrl: 'https://mock-upload-url.example.com',
          publicUrl: `https://placeholder.r2.dev/${mockKey}`,
          fileKey: mockKey,
          expiresIn: 3600
        }, 'Presigned URL generated (mock mode)'));
        return;
      }

      // Generate unique key
      const fileExtension = fileName.split('.').pop();
      const uniqueId = nanoid(12);
      const timestamp = Date.now();
      const fileKey = `unit-documents/${userId}/${timestamp}_${uniqueId}.${fileExtension}`;

      // Create presigned URL
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        ContentType: mimeType as string,
        Metadata: {
          userId: userId,
          originalName: fileName
        }
      });

      const presignedUrl = await getSignedUrl(this.s3Client!, command, {
        expiresIn: 3600 // 1 hour
      });

      const publicUrl = `${this.publicUrl}/${fileKey}`;

      res.json(successResponse({
        presignedUrl,
        publicUrl,
        fileKey,
        expiresIn: 3600,
        instructions: {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType
          },
          body: 'Binary file data'
        }
      }, 'Presigned URL generated successfully'));
    } catch (error) {
      next(error);
    }
  };
}
