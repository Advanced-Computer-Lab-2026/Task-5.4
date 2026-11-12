import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const safeMethods = new Set(['get', 'head', 'options'])
const preAuthPaths = new Set(['/auth/login', '/auth/register'])
let csrfTokenRequest

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const path = new URL(config.url || '', api.defaults.baseURL + '/').pathname
    .replace(/^\/api/, '').replace(/\/$/, '')

  if (safeMethods.has(method) || (method === 'post' && preAuthPaths.has(path))) {
    return config
  }

  // Fetch against the current session rather than caching across login/logout.
  // The browser sends the HttpOnly CSRF cookie; we echo the token in a header
  // that a forged HTML form cannot supply.
  // Share simultaneous fetches so the initial CSRF cookie isn't overwritten
  // by competing requests from this page.
  if (!csrfTokenRequest) {
    csrfTokenRequest = api.get('/csrf-token').finally(() => { csrfTokenRequest = null })
  }
  const { data } = await csrfTokenRequest
  config.headers.set('x-csrf-token', data.csrfToken)
  return config
})
