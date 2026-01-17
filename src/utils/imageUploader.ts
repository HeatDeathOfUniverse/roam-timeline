/**
 * Image upload utility using ImgBB (free image hosting)
 * Documentation: https://api.imgbb.com/
 */

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload an image file to ImgBB
 * @param file - The image file to upload
 * @param apiKey - ImgBB API key (optional, uses anonymous upload if not provided)
 * @returns Promise<UploadResult>
 */
export async function uploadImage(file: File, apiKey?: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('image', file);

    // If API key is provided, include it; otherwise uses anonymous upload (limited)
    if (apiKey) {
      formData.append('key', apiKey);
    }

    const response = await fetch(IMGBB_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
    }

    const data = await response.json();

    if (data.data && data.data.url) {
      return { success: true, url: data.data.url };
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
