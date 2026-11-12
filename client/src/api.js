import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. Because the browser would do that for a forged
// cross-site request too, every state-changing request also carries an
// anti-CSRF token in the `x-csrf-token` header. Only our own origin can read
// that token (CORS), and a forged HTML form cannot set custom headers.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes run before a session exists; the server exempts them.
const CSRF_EXEMPT = ['/auth/login', '/auth/register']
// These change the session, so the token (bound to the session) must be re-fetched.
const SESSION_CHANGING = ['/auth/login', '/auth/register', '/auth/logout']

let csrfToken = null
let csrfTokenPromise = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(res => { csrfToken = res.data.csrfToken; return csrfToken })
      .finally(() => { csrfTokenPromise = null })
  }
  return csrfTokenPromise
}

export function clearCsrfToken() {
  csrfToken = null
}

const matches = (url, list) => list.some(p => (url || '').startsWith(p))

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method) && !matches(config.url, CSRF_EXEMPT)) {
    config.headers.set('x-csrf-token', await getCsrfToken())
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (matches(res.config?.url, SESSION_CHANGING)) clearCsrfToken()
    return res
  },
  async (error) => {
    const { config, response } = error
    // A stale token (e.g. the session changed) — fetch a fresh one and retry once.
    if (response?.status === 403 && /csrf/i.test(response.data?.message || '') && config && !config._csrfRetried) {
      clearCsrfToken()
      config._csrfRetried = true
      return api(config)
    }
    return Promise.reject(error)
  }
)
