
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
});

// Add CSRF protection to state-changing requests
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();

  // GET requests do not change data
  if (['get', 'head', 'options'].includes(method)) {
    return config;
  }

  // Login and registration do not require a CSRF token
  if (
    config.url?.includes('/auth/login') ||
    config.url?.includes('/auth/register')
  ) {
    return config;
  }

  // Request the CSRF token from the backend
  const response = await api.get('/csrf-token');

  const csrfToken = response.data.csrfToken;

  // Attach token to the original request
  config.headers.set('x-csrf-token', csrfToken);

  return config;
});
