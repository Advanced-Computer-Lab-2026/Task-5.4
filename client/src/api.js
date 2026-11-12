import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API. On its own that would leave the
// app open to CSRF, so every state-changing request also carries an anti-CSRF
// token in the `x-csrf-token` header. A forged cross-site request cannot read
// that token or set the header, so the server rejects it with 403.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes run before a session exists and are exempt on the server.
const EXEMPT_URLS = ['/auth/login', '/auth/register']

let csrfToken = null
let pending = null

// Fetch (once) the CSRF token for the current session.
async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!pending) {
    pending = api.get('/csrf-token')
      .then(res => { csrfToken = res.data.csrfToken; return csrfToken })
      .finally(() => { pending = null })
  }
  return pending
}

// The token is bound to the session, so forget it whenever the session changes
// (login, register, logout). The next write will fetch a fresh one.
export function clearCsrfToken() {
  csrfToken = null
}

function needsToken(config) {
  const method = (config.method || 'get').toLowerCase()
  if (SAFE_METHODS.includes(method)) return false
  return !EXEMPT_URLS.some(u => (config.url || '').startsWith(u))
}

api.interceptors.request.use(async (config) => {
  if (needsToken(config)) {
    config.headers.set
      ? config.headers.set('x-csrf-token', await getCsrfToken())
      : (config.headers['x-csrf-token'] = await getCsrfToken())
  }
  return config
})

// If the token went stale (e.g. the session changed in another tab), fetch a
// fresh one and retry the write once.
api.interceptors.response.use(undefined, async (error) => {
  const config = error.config
  if (
    error.response?.status === 403 &&
    /csrf/i.test(error.response?.data?.message || '') &&
    config && !config._csrfRetried && needsToken(config)
  ) {
    config._csrfRetried = true
    clearCsrfToken()
    return api(config)
  }
  return Promise.reject(error)
})
