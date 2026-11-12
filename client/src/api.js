import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
const CSRF_EXEMPT = ['/auth/login', '/auth/register']

// Before every state-changing request, fetch a fresh CSRF token and echo it in
// the `x-csrf-token` header. The token is bound to the session cookie, which
// changes on login/register, so fetching per request never sends a stale one.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (SAFE_METHODS.includes(method) || CSRF_EXEMPT.some((p) => url.includes(p))) {
    return config
  }

  // This is a GET, so it skips the branch above — no recursion.
  const { data } = await api.get('/csrf-token')
  config.headers['x-csrf-token'] = data.csrfToken
  return config
})
