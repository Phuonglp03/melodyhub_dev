import { CLOUDINARY_CONFIG } from "../config/cloudinary";

// Get Cloudinary resources
export const getCloudinaryResources = async (
  folder = "melodyhub",
  maxResults = 50
) => {
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/image/upload?prefix=${folder}/&max_results=${maxResults}`,
      {
        headers: {
          Authorization: `Basic ${btoa(
            `${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`
          )}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.resources || [],
      totalCount: data.total_count || 0,
    };
  } catch (error) {
    console.error("Error fetching Cloudinary resources:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Get Cloudinary resource details
export const getCloudinaryResourceDetails = async (publicId) => {
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/image/upload/${publicId}`,
      {
        headers: {
          Authorization: `Basic ${btoa(
            `${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`
          )}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Error fetching resource details:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Delete Cloudinary resource
export const deleteCloudinaryResource = async (
  publicId,
  resourceType = "image"
) => {
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/${resourceType}/upload/${publicId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${btoa(
            `${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`
          )}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Error deleting resource:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Get Cloudinary usage statistics
export const getCloudinaryUsage = async () => {
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/usage`,
      {
        headers: {
          Authorization: `Basic ${btoa(
            `${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`
          )}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Error fetching usage:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};







