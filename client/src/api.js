import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. Because the browser would also attach that cookie to
// requests triggered by *other* sites, the cookie alone is not proof that a
// request came from our UI. So every state-changing request additionally carries
// an anti-CSRF token in the `x-csrf-token` header — a value only our own pages can
// obtain (CORS stops other origins from reading /csrf-token) and that a forged
// HTML form cannot put in a header.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = new Set(['get', 'head', 'options'])
// Pre-auth routes run before a session exists; the server exempts them.
const CSRF_EXEMPT = ['/auth/login', '/auth/register']
// The token is bound to the session, so it must be refreshed when the session changes.
const SESSION_CHANGING = ['/auth/login', '/auth/register', '/auth/logout']

let csrfToken = null
let pendingToken = null

const matches = (url, list) => list.some(path => (url || '').includes(path))

export async function getCsrfToken({ refresh = false } = {}) {
  if (refresh) csrfToken = null
  if (csrfToken) return csrfToken
  if (!pendingToken) {
    pendingToken = api.get('/csrf-token')
      .then(res => (csrfToken = res.data.csrfToken))
      .finally(() => { pendingToken = null })
  }
  return pendingToken
}

export function clearCsrfToken() {
  csrfToken = null
}

function setHeader(config, name, value) {
  if (config.headers && typeof config.headers.set === 'function') {
    config.headers.set(name, value)
  } else {
    config.headers = { ...(config.headers || {}), [name]: value }
  }
}

// Attach the token to every mutating request.
api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.has(method) && !matches(config.url, CSRF_EXEMPT)) {
    setHeader(config, 'x-csrf-token', await getCsrfToken())
  }
  return config
})

api.interceptors.response.use(
  res => {
    if (matches(res.config?.url, SESSION_CHANGING)) clearCsrfToken()
    return res
  },
  async error => {
    const { config, response } = error
    // A stale token (e.g. the session changed in another tab) — fetch a fresh one
    // and retry the request once.
    if (response?.status === 403 && response.data?.code === 'EBADCSRFTOKEN' && config && !config._csrfRetried) {
      config._csrfRetried = true
      await getCsrfToken({ refresh: true })
      return api(config)
    }
    return Promise.reject(error)
  }
)
