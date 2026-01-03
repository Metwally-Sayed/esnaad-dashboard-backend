import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../../../common/errors/AppError';
import { nanoid } from 'nanoid';

export class R2UploadService {
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
      console.warn('⚠️ R2 upload service disabled: R2 credentials not configured');
      this.bucketName = 'snagging-media';
      this.publicUrl = 'https://placeholder.r2.dev';
      return;
    }

    this.bucketName = process.env.R2_BUCKET_NAME || 'snagging-media';
    this.publicUrl = process.env.R2_PUBLIC_URL || `https://${this.bucketName}.r2.dev`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!
      }
    });
  }

  // Generate presigned URL for upload
  async getPresignedUploadUrl(params: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    userId: string;
  }) {
    if (!this.isConfigured) {
      // Return mock URLs for development when R2 is not configured
      const mockKey = `snagging/${params.userId}/${Date.now()}_${nanoid(12)}.jpg`;
      return {
        presignedUrl: 'https://mock-upload-url.example.com',
        publicUrl: `https://placeholder.r2.dev/${mockKey}`,
        key: mockKey,
        expiresIn: 3600
      };
    }
    // Validate file type (images only)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!allowedMimeTypes.includes(params.mimeType)) {
      throw new AppError('Invalid file type. Only images are allowed', 400);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (params.sizeBytes > maxSize) {
      throw new AppError('File too large. Maximum size is 10MB', 400);
    }

    // Generate unique key
    const fileExtension = params.fileName.split('.').pop();
    const uniqueId = nanoid(12);
    const timestamp = Date.now();
    const key = `snagging/${params.userId}/${timestamp}_${uniqueId}.${fileExtension}`;

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: params.mimeType,
      ContentLength: params.sizeBytes,
      Metadata: {
        userId: params.userId,
        originalName: params.fileName
      }
    });

    const presignedUrl = await getSignedUrl(this.s3Client!, command, {
      expiresIn: 3600 // 1 hour
    });

    const publicUrl = `${this.publicUrl}/${key}`;

    return {
      presignedUrl,
      publicUrl,
      key,
      expiresIn: 3600
    };
  }

  // Batch generate presigned URLs
  async getPresignedUploadUrls(files: Array<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>, userId: string) {
    const urls = await Promise.all(
      files.map(file => this.getPresignedUploadUrl({
        ...file,
        userId
      }))
    );

    return urls;
  }
}