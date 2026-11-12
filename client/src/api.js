import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. On its own that would leave the app open to CSRF,
// so every state-changing request also carries an anti-CSRF token in the
// `x-csrf-token` header — a value only our own origin can read (CORS blocks
// other sites from reading /csrf-token) and that a plain HTML form cannot set.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes are exempt on the server (no session exists yet).
const CSRF_EXEMPT = ['/auth/login', '/auth/register']

let csrfToken = null
let pending = null

// Fetch (and cache) a CSRF token for the current session.
async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!pending) {
    pending = api.get('/csrf-token')
      .then(res => { csrfToken = res.data.csrfToken; return csrfToken })
      .finally(() => { pending = null })
  }
  return pending
}

// The token is bound to the session, so it must be refreshed whenever the
// session changes (login / register / logout).
export function clearCsrfToken() {
  csrfToken = null
}

const isSessionChange = (url = '') =>
  CSRF_EXEMPT.some(p => url.includes(p)) || url.includes('/auth/logout')

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (!SAFE_METHODS.includes(method) && !CSRF_EXEMPT.some(p => url.includes(p))) {
    const token = await getCsrfToken()
    config.headers = config.headers || {}
    if (typeof config.headers.set === 'function') config.headers.set('x-csrf-token', token)
    else config.headers['x-csrf-token'] = token
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (isSessionChange(res.config?.url)) clearCsrfToken()
    return res
  },
  async (error) => {
    const { config, response } = error
    // A stale token (e.g. the session changed) -> fetch a fresh one and retry once.
    if (response?.status === 403 && config && !config._csrfRetried &&
        /csrf/i.test(response.data?.message || '')) {
      clearCsrfToken()
      config._csrfRetried = true
      return api(config)
    }
    return Promise.reject(error)
  }
)
