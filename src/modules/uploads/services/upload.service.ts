import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ValidationError } from '@/common/errors/AppError';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Cloudflare R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || process.env.AWS_S3_BUCKET || 'esnaad-dashboard';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_CUSTOM_DOMAIN = process.env.R2_CUSTOM_DOMAIN; // Optional custom domain

// File upload constraints
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  etag?: string;
  size?: number;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  fields?: Record<string, string>;
}

export class UploadService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    // Initialize S3 client for Cloudflare R2
    this.s3Client = new S3Client({
      region: 'auto', // R2 uses 'auto' region
      endpoint: R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined,
      credentials: R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY ? {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      } : undefined,
    });
    this.bucket = R2_BUCKET;
  }

  // Get public URL for a file
  private getPublicUrl(key: string): string {
    if (R2_CUSTOM_DOMAIN) {
      return `${R2_CUSTOM_DOMAIN}/${key}`;
    }
    return `${R2_PUBLIC_URL}/${this.bucket}/${key}`;
  }

  // Validate file type
  private validateFileType(mimeType: string, allowedTypes: string[]): void {
    if (!allowedTypes.includes(mimeType)) {
      throw new ValidationError(`File type ${mimeType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
  }

  // Validate file size
  private validateFileSize(size: number, maxSize: number = MAX_FILE_SIZE): void {
    if (size > maxSize) {
      throw new ValidationError(`File size ${size} bytes exceeds maximum allowed size of ${maxSize} bytes`);
    }
  }

  // Generate unique file key
  private generateFileKey(prefix: string, filename: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    const extension = filename.split('.').pop();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${prefix}/${timestamp}-${uuid}-${safeFilename}`;
  }

  // Upload file to R2
  async uploadToR2(
    buffer: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: metadata,
      });

      const response = await this.s3Client.send(command);

      return {
        url: this.getPublicUrl(key),
        key,
        bucket: this.bucket,
        etag: response.ETag,
        size: buffer.length,
      };
    } catch (error: any) {
      console.error('R2 upload error:', error);
      console.error('R2 error details:', {
        message: error.message,
        code: error.Code || error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        bucket: this.bucket,
        key: key
      });
      throw new ValidationError(`Failed to upload file to storage: ${error.message}`);
    }
  }

  // Generate presigned URL for direct upload
  async generatePresignedUrl(
    filename: string,
    mimeType: string,
    prefix: string = 'uploads',
    expiresIn: number = 3600 // 1 hour
  ): Promise<PresignedUrlResult> {
    const key = this.generateFileKey(prefix, filename);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      return {
        uploadUrl,
        publicUrl: this.getPublicUrl(key),
        key,
      };
    } catch (error) {
      console.error('Presigned URL generation error:', error);
      throw new ValidationError('Failed to generate upload URL');
    }
  }

  // Generate presigned URL for image upload
  async generateImagePresignedUrl(
    filename: string,
    mimeType: string,
    prefix: string = 'images'
  ): Promise<PresignedUrlResult> {
    this.validateFileType(mimeType, ALLOWED_IMAGE_TYPES);
    return this.generatePresignedUrl(filename, mimeType, prefix);
  }

  // Generate presigned URL for document upload
  async generateDocumentPresignedUrl(
    filename: string,
    mimeType: string,
    prefix: string = 'documents'
  ): Promise<PresignedUrlResult> {
    this.validateFileType(mimeType, ALLOWED_DOCUMENT_TYPES);
    return this.generatePresignedUrl(filename, mimeType, prefix);
  }

  // Delete file from R2
  async deleteFromR2(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('R2 delete error:', error);
      throw new ValidationError('Failed to delete file from storage');
    }
  }

  // Get presigned URL for private file download
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
    responseContentDisposition?: string
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: responseContentDisposition,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Presigned download URL error:', error);
      throw new ValidationError('Failed to generate download URL');
    }
  }

  // Upload with validation
  async uploadWithValidation(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    options: {
      prefix?: string;
      maxSize?: number;
      allowedTypes?: string[];
      metadata?: Record<string, string>;
    } = {}
  ): Promise<UploadResult> {
    const {
      prefix = 'uploads',
      maxSize = MAX_FILE_SIZE,
      allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES],
      metadata = {}
    } = options;

    // Validate file
    this.validateFileSize(buffer.length, maxSize);
    this.validateFileType(mimeType, allowedTypes);

    // Generate key
    const key = this.generateFileKey(prefix, filename);

    // Calculate file hash
    const hash = createHash('sha256').update(buffer).digest('hex');
    const enhancedMetadata = {
      ...metadata,
      originalName: filename,
      hash,
      uploadedAt: new Date().toISOString(),
    };

    // Upload to R2
    return this.uploadToR2(buffer, key, mimeType, enhancedMetadata);
  }
}