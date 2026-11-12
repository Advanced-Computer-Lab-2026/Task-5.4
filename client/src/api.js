import axios from 'axios';

// Must match the server's PORT (README: 4000)
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true, // send cookies
});

let csrfPromise = null;

// fetch a fresh CSRF token from the server and cache it
export function refreshCsrf() {
  csrfPromise = api.get('/csrf-token').then(({ data }) => data.csrfToken);
  return csrfPromise;
}

// before every state-changing request, attach the token
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    if (!csrfPromise) refreshCsrf();
    config.headers['x-csrf-token'] = await csrfPromise;
  }
  return config;
});

// if the token is stale (e.g. session changed after login), fetch a new one and retry once
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (
      response?.status === 403 &&
      /csrf/i.test(JSON.stringify(response.data || '')) &&
      !config._csrfRetried
    ) {
      config._csrfRetried = true;
      await refreshCsrf();
      return api(config);
    }
    return Promise.reject(error);
  }
);

export default api;