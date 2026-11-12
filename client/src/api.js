import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. The CSRF token header proves the request came from
// our own UI, not a forged cross-site form.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Methods that change state and therefore need CSRF protection.
const MUTATING_METHODS = ['post', 'put', 'patch', 'delete']

// Before every mutating request, fetch a CSRF token from the server and attach
// it as the x-csrf-token header. The server validates this token + the
// matching __csrf cookie (double-submit pattern).
// We use the same `api` instance so that any custom adapter (e.g. in tests)
// is respected.
api.interceptors.request.use(async (config) => {
  if (MUTATING_METHODS.includes(config.method)) {
    try {
      const { data } = await api.get('/csrf-token')
      config.headers['x-csrf-token'] = data.csrfToken
    } catch (err) {
      // If the token endpoint is unavailable, proceed without it; the server
      // will reject the request with 403 if CSRF protection is active.
      console.warn('Could not fetch CSRF token:', err.message)
    }
  }
  return config
})
