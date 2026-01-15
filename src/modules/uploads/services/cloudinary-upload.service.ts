import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../../../common/errors/AppError';
import { nanoid } from 'nanoid';

export class CloudinaryUploadService {
  private isConfigured: boolean = false;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    this.isConfigured = !!(cloudName && apiKey && apiSecret);

    if (!this.isConfigured) {
      console.warn('⚠️ Cloudinary upload service disabled: Cloudinary credentials not configured');
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });

    console.log('☁️  Cloudinary Configuration:');
    console.log('  Cloud Name:', cloudName);
    console.log('  API Key:', apiKey);
  }

  // Direct upload to Cloudinary
  async uploadFileDirectly(params: {
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
    userId: string;
  }) {
    if (!this.isConfigured) {
      // Return mock data for development when Cloudinary is not configured
      const mockKey = `documents/${params.userId}/${Date.now()}_${nanoid(12)}.pdf`;
      return {
        publicUrl: `https://placeholder.cloudinary.com/${mockKey}`,
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
      'image/heic',
      'image/heif',
      'application/pdf'
    ];

    // Check MIME type or allow any image/* type (for mobile camera captures)
    const isValidType =
      allowedMimeTypes.includes(params.mimeType) ||
      params.mimeType.startsWith('image/') ||
      params.mimeType === ''; // Empty type can happen with some mobile uploads

    if (!isValidType) {
      throw new AppError('Invalid file type. Only images and PDFs are allowed', 400);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (params.fileBuffer.length > maxSize) {
      throw new AppError('File too large. Maximum size is 10MB', 400);
    }

    // Generate unique public_id (without folder, since we'll use the folder option)
    const uniqueId = nanoid(12);
    const timestamp = Date.now();

    // Add file extension for PDFs to ensure proper download with extension
    const fileExtension = params.mimeType === 'application/pdf' ? '.pdf' : '';
    const publicId = `${params.userId}/${timestamp}_${uniqueId}${fileExtension}`;

    console.log('📤 Uploading to Cloudinary:');
    console.log('  Public ID:', publicId);
    console.log('  File name:', params.fileName);
    console.log('  File size:', params.fileBuffer.length, 'bytes');
    console.log('  MIME type:', params.mimeType);

    try {
      // Determine resource type based on MIME type
      const resourceType = params.mimeType === 'application/pdf' ? 'raw' : 'image';

      // Upload to Cloudinary using upload_stream
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: resourceType,
            folder: 'esnaad-dashboard/documents',
            context: {
              userId: params.userId,
              originalName: params.fileName
            }
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        uploadStream.end(params.fileBuffer);
      });

      console.log('✅ Upload successful!');
      console.log('  Secure URL:', result.secure_url);
      console.log('  Public ID:', result.public_id);
      console.log('  Resource Type:', result.resource_type);
      console.log('  Format:', result.format);

      return {
        publicUrl: result.secure_url,
        key: result.public_id
      };
    } catch (error: any) {
      console.error('❌ Upload failed:', error.message);
      throw new AppError(`Upload failed: ${error.message}`, 500);
    }
  }
}
