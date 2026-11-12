import axios from 'axios';

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. To protect against CSRF attacks, mutating requests
// (POST, PUT, PATCH, DELETE) must also carry a secret anti-CSRF token in the
// `x-csrf-token` header, which cross-site attacker requests cannot read or set.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
});

let csrfToken = null;

export const fetchCsrfToken = async () => {
  try {
    const res = await api.get('/csrf-token');
    csrfToken = res.data?.csrfToken || null;
    return csrfToken;
  } catch (err) {
    return null;
  }
};

export const clearCsrfToken = () => {
  csrfToken = null;
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  const isMutating = ['post', 'put', 'patch', 'delete'].includes(method);

  if (isMutating && !(config.url || '').includes('/csrf-token')) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    if (csrfToken) {
      if (typeof config.headers?.set === 'function') {
        config.headers.set('x-csrf-token', csrfToken);
      } else {
        config.headers = config.headers || {};
        config.headers['x-csrf-token'] = csrfToken;
      }
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      csrfToken = null;
    }
    return Promise.reject(error);
  }
);
