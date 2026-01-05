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
    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

    this.isConfigured = !!(accountId && accessKeyId && secretAccessKey);

    if (!this.isConfigured) {
      console.warn('⚠️ R2 upload service disabled: R2 credentials not configured');
      this.bucketName = 'snagging-media';
      this.publicUrl = 'https://placeholder.r2.dev';
      return;
    }

    this.bucketName = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || 'snagging-media';
    this.publicUrl = process.env.R2_PUBLIC_URL || `https://${this.bucketName}.r2.dev`;

    console.log('🪣 R2 Configuration:');
    console.log('  Bucket Name:', this.bucketName);
    console.log('  Public URL:', this.publicUrl);
    console.log('  Account ID:', accountId);
    console.log('  Access Key ID:', accessKeyId);
    console.log('  Secret Key (first 10 chars):', secretAccessKey?.substring(0, 10) + '...');
    console.log('  Endpoint:', `https://${accountId}.r2.cloudflarestorage.com`);

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
    // Validate file type (images and PDFs)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];

    if (!allowedMimeTypes.includes(params.mimeType)) {
      throw new AppError('Invalid file type. Only images and PDFs are allowed', 400);
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
    // DON'T set ContentType in the command - it gets added to signature and causes mismatches
    // The client will send Content-Type header, but it won't be validated
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      // ContentType removed - causes signature mismatches when browser adds headers
      Metadata: {
        userId: params.userId,
        originalName: params.fileName
      },
      ChecksumAlgorithm: undefined // Disable checksums
    });

    const presignedUrl = await getSignedUrl(this.s3Client!, command, {
      expiresIn: 3600, // 1 hour
      // Disable checksums in presigned URL
      signableHeaders: new Set()
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

  // Direct upload to R2 (bypasses presigned URL issues)
  async uploadFileDirectly(params: {
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
    userId: string;
  }) {
    if (!this.isConfigured) {
      // Return mock data for development when R2 is not configured
      const mockKey = `documents/${params.userId}/${Date.now()}_${nanoid(12)}.pdf`;
      return {
        publicUrl: `https://placeholder.r2.dev/${mockKey}`,
        key: mockKey
      };
    }

    // Validate file type (images and PDFs)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];

    if (!allowedMimeTypes.includes(params.mimeType)) {
      throw new AppError('Invalid file type. Only images and PDFs are allowed', 400);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (params.fileBuffer.length > maxSize) {
      throw new AppError('File too large. Maximum size is 10MB', 400);
    }

    // Generate unique key
    const fileExtension = params.fileName.split('.').pop();
    const uniqueId = nanoid(12);
    const timestamp = Date.now();
    const key = `documents/${params.userId}/${timestamp}_${uniqueId}.${fileExtension}`;

    // Upload directly to R2 using PutObjectCommand
    // Minimal configuration to avoid signature issues
    console.log('📤 Attempting upload to R2:');
    console.log('  Bucket:', this.bucketName);
    console.log('  Bucket (JSON):', JSON.stringify(this.bucketName));
    console.log('  Key:', key);
    console.log('  File size:', params.fileBuffer.length, 'bytes');

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: params.fileBuffer
    });

    console.log('  Command bucket:', command.input.Bucket);

    try {
      await this.s3Client!.send(command);
      console.log('✅ Upload successful!');
    } catch (error: any) {
      console.error('❌ Upload failed:', error.message);
      console.error('  Error code:', error.Code || error.name);
      console.error('  Status:', error.$metadata?.httpStatusCode);
      throw error;
    }

    const publicUrl = `${this.publicUrl}/${key}`;

    return {
      publicUrl,
      key
    };
  }
}