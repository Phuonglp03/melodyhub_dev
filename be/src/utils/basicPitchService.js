/**
 * Tab Generation Service (Backend)
 * Redirects to frontend for Basic-Pitch AI processing
 */

/**
 * Generate guitar tab - tells frontend to handle it
 */
export const generateTabFromAudio = async (audioFilePath) => {
  // Basic-Pitch works best in browser environment
  // Return error to trigger frontend processing
  throw new Error("Please process audio in frontend with Basic-Pitch");
};

export default {
  generateTabFromAudio,
};
