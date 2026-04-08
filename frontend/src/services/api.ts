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

// Handle 401 errors — token expired or invalid
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.status);

    // Any 401 response means the user's session is no longer valid (expired
    // or revoked). Clear stored auth and bounce them to /login so they can
    // re-authenticate, instead of leaving the page silently broken with
    // every subsequent request also 401'ing. We avoid an infinite loop on
    // the login page itself by checking the URL we're on.
    if (error.response?.status === 401) {
      const onLoginPage = window.location.pathname === '/login';
      // /auth/me 401s during initial load shouldn't redirect — that's just
      // "no session yet"; the AuthContext handles it.
      const isAuthCheck = error.config?.url === '/auth/me';
      if (!onLoginPage && !isAuthCheck) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Preserve where they were so we can return them after login
        const returnTo = window.location.pathname + window.location.search;
        window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
      } else if (isAuthCheck) {
        // Existing behavior for /auth/me — just clear and go to /login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!onLoginPage) window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
