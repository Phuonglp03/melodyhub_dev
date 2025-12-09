import { CLOUDINARY_CONFIG, UPLOAD_PRESETS } from "../config/cloudinary";

// Upload file to Cloudinary
export const uploadToCloudinary = async (
  file,
  preset = UPLOAD_PRESETS.IMAGE,
  options = {}
) => {
  try {
    const { resource_type: resourceType = "image", ...formOptions } = options;
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", preset);

    Object.entries(formOptions).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data?.error?.message ||
        data?.error ||
        response.statusText ||
        "Bad Request";
      console.error("[Cloudinary] Upload error details:", {
        status: response.status,
        statusText: response.statusText,
        error: data,
        preset,
        resourceType,
        options: formOptions,
      });
      throw new Error(`Upload failed: ${errorMessage}`);
    }

    return {
      success: true,
      data: {
        public_id: data.public_id,
        secure_url: data.secure_url,
        url: data.url,
        format: data.format,
        width: data.width,
        height: data.height,
        bytes: data.bytes,
        duration: data.duration, // For audio/video files
      },
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Upload audio file
export const uploadAudio = async (audioFile, options = {}) => {
  const audioOptions = {
    resource_type: "video", // Cloudinary treats audio as video
    folder: "melodyhub/audio",
    ...options,
  };

  return await uploadToCloudinary(
    audioFile,
    UPLOAD_PRESETS.AUDIO,
    audioOptions
  );
};

// Upload image file
export const uploadImage = async (imageFile, options = {}) => {
  const imageOptions = {
    resource_type: "image",
    folder: "melodyhub/images",
    ...options,
  };

  return await uploadToCloudinary(
    imageFile,
    UPLOAD_PRESETS.IMAGE,
    imageOptions
  );
};

// Upload playlist cover image
export const uploadPlaylistCover = async (imageFile, options = {}) => {
  const imageOptions = {
    resource_type: "image",
    ...options,
  };

  if (UPLOAD_PRESETS.PLAYLIST_COVER) {
    const result = await uploadToCloudinary(
      imageFile,
      UPLOAD_PRESETS.PLAYLIST_COVER,
      imageOptions
    );
    if (result.success) {
      return result;
    }
    const errMsg = result.error?.toLowerCase() || "";
    if (
      !errMsg.includes("upload preset not found") &&
      !errMsg.includes("invalid upload preset")
    ) {
      return result;
    }
    console.warn(
      "[Cloudinary] Playlist cover preset not found – falling back to default image preset."
    );
  }

  return await uploadToCloudinary(
    imageFile,
    UPLOAD_PRESETS.IMAGE,
    imageOptions
  );
};

// Upload avatar
export const uploadAvatar = async (avatarFile, options = {}) => {
  const avatarOptions = {
    resource_type: "image",
    folder: "melodyhub/avatars",
    transformation: [
      { width: 200, height: 200, crop: "fill", gravity: "face" },
    ],
    ...options,
  };

  return await uploadToCloudinary(
    avatarFile,
    UPLOAD_PRESETS.AVATAR,
    avatarOptions
  );
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (
  publicId,
  resourceType = "image"
) => {
  try {
    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("cloud_name", CLOUDINARY_CONFIG.cloud_name);
    formData.append("api_key", CLOUDINARY_CONFIG.api_key);
    formData.append("api_secret", CLOUDINARY_CONFIG.api_secret);
    formData.append("resource_type", resourceType);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/image/destroy`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Generate waveform data from audio URL
export const generateWaveform = async (audioUrl) => {
  try {
    // This would typically be done on the backend
    // For now, return mock waveform data
    return {
      success: true,
      data: Array.from({ length: 8 }, () => Math.random()),
    };
  } catch (error) {
    console.error("Waveform generation error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
