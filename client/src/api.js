import axios from 'axios';

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true,
});

let csrfToken = null;

export async function getCsrfToken() {
  if (!csrfToken) {
    const res = await api.get('/csrf-token');
    csrfToken = res.data.csrfToken;
  }
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || '').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    if (!config.url || !config.url.includes('/csrf-token')) {
      const token = await getCsrfToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers['x-csrf-token'] = token;
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || '';
    if (url.includes('/auth/login') || url.includes('/auth/logout') || url.includes('/auth/register')) {
      clearCsrfToken();
    }
    return response;
  },
  (error) => Promise.reject(error)
);
