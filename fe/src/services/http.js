import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9999/api';

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  let token = localStorage.getItem('token');
  if (!token) {
    try {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const userObj = JSON.parse(userRaw);
        token = userObj?.token || userObj?.accessToken;
      }
    } catch {}
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  try {
    console.log('[HTTP]', config.method?.toUpperCase(), config.baseURL + config.url, config.params || '', config.headers['Content-Type']);
    
    // Nếu là FormData, đảm bảo không set Content-Type (browser sẽ tự set với boundary)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      // eslint-disable-next-line no-console
      console.log('[HTTP] FormData detected, removed Content-Type header');
    }
  } catch {}
  
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || error.message || 'Request error';
    return Promise.reject(new Error(message));
  }
);

export default http;


