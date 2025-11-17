import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

/**
 * Uploads a file buffer to Cloudinary.
 * @param {Buffer} fileBuffer - The file buffer (e.g., from req.file.buffer).
 * @param {string} folder - The folder name in Cloudinary to store the file.
 * @param {string} resourceType - 'image', 'video', or 'auto'.
 * IMPORTANT: Use 'video' for audio files (mp3, wav, etc.).
 * @returns {Promise<object>} - A promise that resolves with the Cloudinary upload result.
 */
export const uploadFromBuffer = (fileBuffer, folder, resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    console.log(
      `[CLOUDINARY] Uploading to folder: ${folder}, resource_type: ${resourceType}`
    );

    // Create an upload stream to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: resourceType,
        // Don't apply transformations during upload to avoid codec issues
        // Cloudinary will store the original file format
      },
      (error, result) => {
        if (error) {
          // If there's an error, reject the promise
          console.error("[CLOUDINARY] Upload error:", error);
          return reject(error);
        }
        // If successful, resolve the promise with the result
        console.log("[CLOUDINARY] Upload successful:", result.public_id);
        resolve(result);
      }
    );

    // Pipe the file buffer into the upload stream
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};
