/**
 * Image upload utility using Cloudinary (free tier available)
 * Sign up for free at: https://cloudinary.com/users/register/free
 *
 * Configuration:
 * - Get your cloud name from Cloudinary Dashboard
 * - Create an unsigned upload preset in Settings → Upload
 */

const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/{cloud_name}/image/upload';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload an image file to Cloudinary
 * @param file - The image file to upload
 * @param cloudName - Your Cloudinary cloud name (get from dashboard)
 * @param preset - Your Cloudinary unsigned upload preset
 * @returns Promise<UploadResult>
 */
export async function uploadImage(file: File, cloudName: string, preset: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);

    const response = await fetch(
      CLOUDINARY_UPLOAD_URL.replace('{cloud_name}', cloudName),
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
    }

    const data = await response.json();

    if (data.secure_url) {
      return { success: true, url: data.secure_url };
    } else {
      return { success: false, error: 'No URL in response' };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Generate markdown image syntax
 * @param url - Image URL
 * @param alt - Alt text (optional)
 * @returns Markdown image syntax
 */
export function markdownImage(url: string, alt?: string): string {
  const altText = alt || 'Image';
  return `![${altText}](${url})`;
}
