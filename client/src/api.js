import axios from 'axios'

// withCredentials sends the httpOnly auth cookie (and the CSRF cookie).
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// CSRF: every state-changing request echoes a fresh, session-bound token in the
// x-csrf-token header. A cross-site attacker can neither read nor set it.
const SAFE = ['get', 'head', 'options']
const AUTH_EXEMPT = ['/auth/login', '/auth/register']

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (SAFE.includes(method) || AUTH_EXEMPT.includes(config.url)) return config

  const { data } = await api.get('/csrf-token')
  config.headers = config.headers || {}
  if (typeof config.headers.set === 'function') {
    config.headers.set('x-csrf-token', data.csrfToken)
  } else {
    config.headers['x-csrf-token'] = data.csrfToken
  }
  return config
})
