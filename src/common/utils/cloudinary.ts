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

  // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/raw/upload/{public_id}
  // Note: We're not including the version (v123456) which Cloudinary adds automatically
  // The URL works without it, but if files aren't loading, we may need to store the full secure_url instead

  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${fileKey}`;
}
