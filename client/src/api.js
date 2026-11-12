import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// ---- CSRF ------------------------------------------------------------------
// The server only accepts a state-changing request if it carries the CSRF
// token in the `x-csrf-token` header. We fetch it from our own API (an
// attacker's page cannot read this response) and attach it to every write.

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes are exempt on the server, so no token is needed for them.
const EXEMPT_URLS = ['/auth/login', '/auth/register']
// The token is bound to the session, so it must be refetched when that changes.
const SESSION_CHANGING_URLS = ['/auth/login', '/auth/register', '/auth/logout']

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

function resetCsrfToken() {
  csrfToken = null
}

const matches = (url, list) => list.some(u => (url || '').includes(u))

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method) && !matches(config.url, EXEMPT_URLS)) {
    config.headers = config.headers || {}
    const token = await getCsrfToken()
    if (typeof config.headers.set === 'function') config.headers.set('x-csrf-token', token)
    else config.headers['x-csrf-token'] = token
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (matches(res.config?.url, SESSION_CHANGING_URLS)) resetCsrfToken()
    return res
  },
  async (error) => {
    const { config, response } = error
    // Token went stale (e.g. session changed): refetch once and retry.
    if (response?.status === 403 && response.data?.code === 'EBADCSRFTOKEN' && config && !config._csrfRetried) {
      config._csrfRetried = true
      resetCsrfToken()
      return api(config)
    }
    return Promise.reject(error)
  }
)
