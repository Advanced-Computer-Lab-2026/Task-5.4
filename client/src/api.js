import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

api.interceptors.request.use(async (config) => {

  const method = (config.method || 'get').toLowerCase();

  // GET, HEAD and OPTIONS do not need CSRF protection
  if (!['post', 'put', 'patch', 'delete'].includes(method)) {
    return config;
  }

  // Login and registration are exempt
  if (
    ['/auth/login', '/auth/register'].includes(config.url)
  ) {
    return config;
  }

  // Get a CSRF token from the server
  const response = await api.get('/csrf-token');

  // Attach the token to the request header
  config.headers = config.headers || {};

  config.headers['x-csrf-token'] = response.data.csrfToken;

  return config;
});
