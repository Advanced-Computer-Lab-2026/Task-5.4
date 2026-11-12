
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
});

// Store the CSRF token after retrieving it.
let csrfToken = null;

// Retrieve a CSRF token from the server.
async function getCsrfToken() {
  if (!csrfToken) {
    const response = await api.get('/csrf-token');
    csrfToken = response.data.csrfToken;
  }

  return csrfToken;
}

// Clear the token when the authentication session changes.
export function clearCsrfToken() {
  csrfToken = null;
}

// Automatically attach the token to state-changing requests.
api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase();

  // GET, HEAD, and OPTIONS do not require CSRF protection.
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return config;
  }

  // Login and registration are exempt.
  if (
    method === 'POST' &&
    ['/auth/login', '/auth/register'].includes(config.url)
  ) {
    return config;
  }

  // Retrieve and attach the CSRF token.
  config.headers['x-csrf-token'] = await getCsrfToken();

  return config;
});
