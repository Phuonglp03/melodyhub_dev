import multer from "multer";
import {
  uploadAudio,
  uploadImage,
  uploadPostMedia,
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../config/cloudinary.js";

// Middleware để xử lý upload audio
export const handleAudioUpload = uploadAudio.single("audio");

// Middleware để xử lý upload image
export const handleImageUpload = uploadImage.single("image");

// Middleware để xử lý multiple audio uploads
export const handleMultipleAudioUpload = uploadAudio.array("audios", 5);

// Middleware để xử lý multiple image uploads
export const handleMultipleImageUpload = uploadImage.array("images", 10);

// Middleware để xử lý mixed uploads (audio + image)
export const handleMixedUpload = uploadAudio.fields([
  { name: "audio", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

// Middleware để xử lý post media uploads (multiple files)
export const handlePostMediaUpload = uploadPostMedia.array("media", 10);

// Error handling middleware cho upload
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File quá lớn. Kích thước tối đa là 100MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Quá nhiều file được upload cùng lúc.",
      });
    }
  }

  if (error.message.includes("Chỉ cho phép file")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
};

// Utility function để xóa file
export { deleteFromCloudinary, uploadToCloudinary };

// Export uploadAudio for direct use (needed for lickRoutes)
export { uploadAudio };
