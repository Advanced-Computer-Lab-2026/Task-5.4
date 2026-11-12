import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// On its own that would leave the app open to CSRF, so every state-changing
// request below also carries an anti-CSRF token in the `x-csrf-token` header.
// A forged cross-site request cannot read that token nor set that header.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

// Pre-auth routes run before a session exists, so the server does not require
// a token for them (and the session the token is bound to changes after them).
const CSRF_EXEMPT_URLS = ['/auth/login', '/auth/register']

// Routes that change the session the token is bound to.
const SESSION_CHANGING_URLS = ['/auth/login', '/auth/register', '/auth/logout']

const matches = (url, list) => list.some(path => (url || '').includes(path))

// One cached token (as a promise, so concurrent writes share a single fetch).
let csrfTokenPromise = null

export function resetCsrfToken() {
  csrfTokenPromise = null
}

function getCsrfToken() {
  if (!csrfTokenPromise) {
    // A GET, so it is not intercepted again below (no recursion).
    csrfTokenPromise = api.get('/csrf-token')
      .then(res => res.data.csrfToken)
      .catch(err => {
        csrfTokenPromise = null
        throw err
      })
  }
  return csrfTokenPromise
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (MUTATING_METHODS.has(method) && !matches(config.url, CSRF_EXEMPT_URLS)) {
    const token = await getCsrfToken()
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('x-csrf-token', token)
    } else {
      config.headers = { ...config.headers, 'x-csrf-token': token }
    }
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    // Logging in/out changes the session, so any cached token is now stale.
    if (matches(res.config?.url, SESSION_CHANGING_URLS)) resetCsrfToken()
    return res
  },
  async (error) => {
    const { config, response } = error
    if (config && matches(config.url, SESSION_CHANGING_URLS)) resetCsrfToken()

    // The cached token was rejected (e.g. the session changed or the CSRF
    // cookie expired): drop it and retry the request once with a fresh one.
    const isCsrfError = response?.status === 403 && response.data?.code === 'EBADCSRFTOKEN'
    if (isCsrfError && config && !config._csrfRetried) {
      config._csrfRetried = true
      resetCsrfToken()
      return api(config)
    }
    return Promise.reject(error)
  }
)
