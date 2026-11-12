import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})
let csrfToken = null;

api.interceptors.request.use(async (config) => {
  // 1. Get the HTTP method (default to 'get' if not specified)
  const method = (config.method || 'get').toLowerCase();

  // 2. State-changing HTTP methods that need CSRF protection
  const mutatingMethods = ['post', 'put', 'patch', 'delete'];

  // 3. If this request modifies data, ensure we have a token
  if (mutatingMethods.includes(method)) {
    if (!csrfToken) {
      const res = await api.get('/csrf-token');
      csrfToken = res.data.csrfToken;
    }
    // 4. Attach the token header so the server accepts the request
    config.headers = config.headers || {};
    config.headers['x-csrf-token'] = csrfToken;
  }

  return config;
});