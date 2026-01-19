/**
 * Cloudinary utilities for generating public URLs from file keys
 */

/**
 * Generates a Cloudinary public URL from a file key (public_id)
 * @param fileKey - The Cloudinary public_id stored in the database
 * @returns Full Cloudinary URL for accessing the file
 */
export function getCloudinaryUrl(fileKey: string): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();

  if (!cloudName) {
    // Return placeholder if Cloudinary not configured
    return `https://placeholder.cloudinary.com/${fileKey}`;
  }

  // The fileKey is the public_id from Cloudinary
  // For raw files (PDFs), Cloudinary uses resource_type 'raw'
  const resourceType = 'raw';

  // Cloudinary URL format without version (it will redirect to latest version)
  // Format: https://res.cloudinary.com/{cloud_name}/raw/upload/{public_id}

  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${fileKey}`;
}
