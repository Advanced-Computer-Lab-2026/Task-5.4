import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Login/register run before a session exists, so the server exempts them.
const EXEMPT_URLS = ['/auth/login', '/auth/register']

// The CSRF token is bound to the current session, so fetch it fresh for each
// write (cheap, and always valid after login/logout). It is sent in a header,
// which a cross-site attacker page can neither read nor set.
async function fetchCsrfToken() {
  const res = await api.get('/csrf-token')
  return res.data.csrfToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (SAFE_METHODS.includes(method) || EXEMPT_URLS.some((u) => url.includes(u))) {
    return config
  }
  const token = await fetchCsrfToken()
  config.headers.set('x-csrf-token', token)
  return config
})
