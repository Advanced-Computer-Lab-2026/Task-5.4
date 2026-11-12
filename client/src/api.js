import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. On its own that would leave the app open to CSRF,
// so every state-changing request also carries an anti-CSRF token in the
// `x-csrf-token` header: a value only our own page can read and attach.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Login/register run before a session exists, so the server doesn't check a token on them.
const PRE_AUTH_PATHS = ['/auth/login', '/auth/register']

let csrfToken = null
let pending = null

// Fetch (once) the token the server issues for the current session.
async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!pending) {
    pending = api.get('/csrf-token')
      .then(res => (csrfToken = res.data.csrfToken))
      .finally(() => { pending = null })
  }
  return pending
}

// The token is tied to the session, so forget it whenever the session changes.
export function resetCsrfToken() {
  csrfToken = null
}

function needsToken(config) {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (SAFE_METHODS.includes(method)) return false
  return !PRE_AUTH_PATHS.some(p => url.includes(p))
}

api.interceptors.request.use(async (config) => {
  if (needsToken(config)) {
    const token = await getCsrfToken()
    config.headers = config.headers || {}
    if (typeof config.headers.set === 'function') config.headers.set('x-csrf-token', token)
    else config.headers['x-csrf-token'] = token
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    // Logging in, registering or logging out starts a new session.
    const url = res.config?.url || ''
    if (/\/auth\/(login|register|logout)/.test(url)) resetCsrfToken()
    return res
  },
  async (error) => {
    const { config, response } = error
    // A stale token (e.g. the session changed in another tab): refresh once and retry.
    if (response?.status === 403 && config && needsToken(config) && !config._csrfRetried &&
        /csrf/i.test(response.data?.message || '')) {
      config._csrfRetried = true
      resetCsrfToken()
      return api(config)
    }
    return Promise.reject(error)
  }
)
