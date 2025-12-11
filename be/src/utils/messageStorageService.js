import { v2 as cloudinary } from 'cloudinary';

// Cloudinary config (env vars đã được set trong config/cloudinary.js khi server start)
// Nếu chưa config, config lại ở đây
if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const TEXT_THRESHOLD = 500; // Tin nhắn < 500 chars lưu trong MongoDB, >= 500 lưu Cloudinary

/**
 * Upload message text to Cloudinary (raw resource type)
 * @param {string} text - Message text content
 * @param {string} messageId - Unique message ID
 * @returns {Promise<{storageType: string, storageId: string|null, textPreview: string, text?: string}>}
 */
export const uploadMessageText = async (text, messageId) => {
  const textLength = text.length;

  // Tin nhắn ngắn: lưu trực tiếp trong MongoDB (không tốn Cloudinary bandwidth)
  if (textLength < TEXT_THRESHOLD) {
    return {
      storageType: 'mongodb',
      storageId: null,
      text: text, // Lưu trực tiếp
      textPreview: text // Preview = full text
    };
  }

  // Tin nhắn dài: upload lên Cloudinary
  try {
    // Convert text to buffer
    const textBuffer = Buffer.from(text, 'utf8');

    // Upload to Cloudinary as raw file
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'melodyhub/messages',
          resource_type: 'raw',
          public_id: messageId,
          overwrite: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(textBuffer);
    });

    return {
      storageType: 'cloudinary',
      storageId: result.secure_url, // Full URL để download
      textPreview: text.substring(0, 100) + '...', // Preview 100 ký tự đầu
      text: null // Không lưu trong MongoDB
    };
  } catch (error) {
    console.error('[MessageStorage] Cloudinary upload error:', error);
    // Fallback: lưu trong MongoDB nếu Cloudinary fail
    return {
      storageType: 'mongodb',
      storageId: null,
      text: text,
      textPreview: text
    };
  }
};

/**
 * Download message text from Cloudinary
 * @param {string} storageType - 'mongodb' or 'cloudinary'
 * @param {string|null} storageId - Cloudinary URL hoặc null
 * @param {string} fallbackText - Text từ MongoDB hoặc preview
 * @returns {Promise<string>}
 */
export const downloadMessageText = async (storageType, storageId, fallbackText = '') => {
  // Nếu lưu trong MongoDB hoặc không có storageId
  if (storageType === 'mongodb' || !storageId) {
    return fallbackText || '';
  }

  // Download từ Cloudinary
  if (storageType === 'cloudinary') {
    try {
      const response = await fetch(storageId);
      if (!response.ok) {
        console.error('[MessageStorage] Cloudinary download failed:', response.status);
        return fallbackText || '';
      }
      const text = await response.text();
      return text;
    } catch (error) {
      console.error('[MessageStorage] Cloudinary download error:', error);
      return fallbackText || '';
    }
  }

  return fallbackText || '';
};

/**
 * Delete message text from Cloudinary
 * @param {string} storageId - Cloudinary URL
 * @returns {Promise<boolean>}
 */
export const deleteMessageText = async (storageId) => {
  if (!storageId || !storageId.includes('cloudinary.com')) {
    return false; // Không phải Cloudinary URL
  }

  try {
    // Extract public_id from URL
    // URL format: https://res.cloudinary.com/xxx/raw/upload/v123/melodyhub/messages/msg123
    const match = storageId.match(/\/melodyhub\/messages\/([^\/]+)/);
    if (!match) {
      console.error('[MessageStorage] Cannot extract public_id from URL:', storageId);
      return false;
    }

    const publicId = `melodyhub/messages/${match[1]}`;
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw'
    });

    return result.result === 'ok';
  } catch (error) {
    console.error('[MessageStorage] Cloudinary delete error:', error);
    return false;
  }
};

