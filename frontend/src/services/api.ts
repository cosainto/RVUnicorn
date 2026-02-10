import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  // Don't set Content-Type here - let axios handle it automatically
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

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

    return response;
  },
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.status);
    if (error.response?.status === 401 && error.config?.url !== '/auth/me') {

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
