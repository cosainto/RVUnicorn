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

// Handle 401 errors — only the canonical session-check endpoint can
// declare a session dead. Every other 401 is a permission denial on a
// specific resource and must NOT tear down the session.
//
// Why: previously ANY 401 from ANY endpoint forcibly logged the user
// out via window.location.href = '/login'. That meant a single soft
// endpoint mistakenly returning 401 (because of a stale JWT, a route
// gated stricter than its callers expected, or just a route with
// authenticateToken on a page that mounts for both authed and
// unauthed users) would boot the user mid-page-load. The campground
// page logout bugs (price-prompt-eligible, then again on claimed
// campgrounds) were both this same root cause.
//
// New policy: only /auth/me's 401 is treated as "session is dead"
// because /auth/me's entire job is to answer "is this token still
// good?" — it's the one endpoint where 401 is unambiguous. For every
// other 401, we just reject the promise and let the caller handle
// the failure (display an error, show a sign-in CTA, etc.). If the
// token really is dead, the next /auth/me call (on refresh or route
// change that re-runs AuthContext) will catch it and bounce.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthCheck = url === '/auth/me' || url.endsWith('/auth/me');
      if (isAuthCheck) {
        // The session-check endpoint says the token is dead — clear
        // local auth and bounce to /login (unless we're already there).
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else {
        // Permission denial on a specific endpoint — log it once for
        // debugging but DO NOT touch the session.
        console.warn('[api] 401 on', url, '(ignored — only /auth/me triggers logout)');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
