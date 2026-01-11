import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  // Don't set Content-Type here - let axios handle it automatically
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  console.log('API Request:', config.url, 'Token exists:', !!token, 'Token:', token?.substring(0, 20) + '...');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Only set Content-Type to JSON if it's not already set (for non-FormData requests)
  if (!config.headers['Content-Type'] && !(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }
  
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.config.url, 'Status:', response.status);
    return response;
  },
  (error) => {
    console.log('API Error:', error.config?.url, 'Status:', error.response?.status);
    if (error.response?.status === 401 && error.config?.url !== '/auth/me') {
      console.log('401 Error - clearing auth and redirecting');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
