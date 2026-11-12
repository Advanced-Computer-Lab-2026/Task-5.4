
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
});

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();

  const safeMethods = ['get', 'head', 'options'];

  const url = config.url || '';

  const isPreAuthRequest =
    url.includes('/auth/login') ||
    url.includes('/auth/register');

  if (!safeMethods.includes(method) && !isPreAuthRequest) {
    const response = await api.get('/csrf-token');

    config.headers = config.headers || {};
    config.headers['x-csrf-token'] = response.data.csrfToken;
  }

  return config;
});
