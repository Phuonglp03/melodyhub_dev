// API Configuration
export const API_CONFIG = {
  // Set to true to use mock data, false to use real backend
  USE_MOCK_DATA: false,

  // Backend API URL
  API_BASE_URL: process.env.REACT_APP_API_URL || "http://localhost:9999/api",

  // Mock data delay (ms) - to simulate network latency
  MOCK_DELAY: 500,
};

// Helper function to check if using mock data
export const isUsingMockData = () => API_CONFIG.USE_MOCK_DATA;

// Helper function to get API base URL
export const getApiBaseUrl = () => API_CONFIG.API_BASE_URL;
