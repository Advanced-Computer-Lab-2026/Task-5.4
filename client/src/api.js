import axios from 'axios'

// `withCredentials: true` sends the httpOnly auth and CSRF cookies to the API.
// Mutating requests also carry the separately retrieved CSRF token below.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = new Set(['get', 'head', 'options'])
const PRE_AUTH_ROUTES = new Set(['/auth/login', '/auth/register'])

// Before every session-backed write, fetch the per-session token and echo it
// in a custom header. A foreign page cannot read this credentialed response.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (SAFE_METHODS.has(method) || PRE_AUTH_ROUTES.has(config.url)) return config

  const { data } = await api.get('/csrf-token')
  if (typeof config.headers?.set === 'function') {
    config.headers.set('x-csrf-token', data.csrfToken)
  } else {
    config.headers = { ...config.headers, 'x-csrf-token': data.csrfToken }
  }

  return config
})
