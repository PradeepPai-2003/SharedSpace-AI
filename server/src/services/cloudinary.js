import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer directly to Cloudinary using a stream.
 * This avoids storing files on the local disk (perfect for ephemeral hosts like Render).
 * 
 * @param {Buffer} fileBuffer - File buffer from multer memoryStorage
 * @param {string} folder - Target folder name in Cloudinary (e.g. 'avatars', 'attachments')
 * @returns {Promise<object>} - Cloudinary upload response object
 */
export const uploadToCloudinary = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `sharedspace/${folder}`,
        resource_type: 'auto', // Detects images, videos, raw files (pdf, docx, etc.) automatically
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    // End stream with file buffer
    stream.end(fileBuffer);
  });
};

export default cloudinary;
