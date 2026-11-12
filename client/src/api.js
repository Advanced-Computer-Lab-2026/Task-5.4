import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. That alone would leave us open to CSRF, because an
// attacker's page gets the cookie attached too. So every state-changing request
// also carries an anti-CSRF token in the `x-csrf-token` header. Only our own
// origin can read that token (from GET /csrf-token) and set the header.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

// Pre-auth routes. No session exists yet, so the server doesn't check a token.
const CSRF_EXEMPT = ['/auth/login', '/auth/register']

// Routes that change the session. The server binds the CSRF token to the
// session, so any cached token goes stale once one of these succeeds.
const SESSION_CHANGING = ['/auth/login', '/auth/register', '/auth/logout']

const matches = (url, list) => list.some(path => (url || '').endsWith(path))

// Cache the token (and any in-flight fetch) so concurrent writes share one request.
let csrfTokenPromise = null

function getCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(res => res.data.csrfToken)
      .catch(err => { csrfTokenPromise = null; throw err })
  }
  return csrfTokenPromise
}

export function resetCsrfToken() {
  csrfTokenPromise = null
}

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  if (MUTATING_METHODS.has(method) && !matches(config.url, CSRF_EXEMPT)) {
    config.headers.set('x-csrf-token', await getCsrfToken())
  }
  return config
})

api.interceptors.response.use(
  res => {
    if (matches(res.config.url, SESSION_CHANGING)) resetCsrfToken()
    return res
  },
  async err => {
    const { config, response } = err
    if (config && matches(config.url, SESSION_CHANGING)) resetCsrfToken()

    // The cached token went stale (e.g. the session cookie expired or was
    // replaced in another tab). Get a fresh token and retry once.
    if (response?.status === 403 && response.data?.code === 'EBADCSRFTOKEN' && config && !config._csrfRetried) {
      config._csrfRetried = true
      resetCsrfToken()
      return api(config)
    }
    return Promise.reject(err)
  }
)
