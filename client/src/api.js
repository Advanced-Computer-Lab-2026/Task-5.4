import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. Because the browser would also attach that cookie
// to requests forged by other sites, every state-changing request additionally
// carries an anti-CSRF token in the `x-csrf-token` header. Only our own origin
// can read that token (CORS blocks other sites from reading the response), so a
// forged request cannot include it and the server rejects it with 403.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-authentication routes: no session exists yet, so the server exempts them.
const CSRF_EXEMPT = ['/auth/login', '/auth/register']
// Routes that change the session (and thus the token's binding) — drop the cached token after them.
const SESSION_CHANGING = ['/auth/login', '/auth/register', '/auth/logout']

let csrfToken = null
let pendingToken = null

function matches(url, list) {
  return list.some(path => (url || '').endsWith(path))
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!pendingToken) {
    pendingToken = api.get('/csrf-token')
      .then(res => { csrfToken = res.data.csrfToken; return csrfToken })
      .finally(() => { pendingToken = null })
  }
  return pendingToken
}

// Attach the CSRF token to every mutating request.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method) && !matches(config.url, CSRF_EXEMPT)) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (matches(res.config?.url, SESSION_CHANGING)) csrfToken = null
    return res
  },
  async (error) => {
    const { config, response } = error
    // The token may be stale (e.g. issued for a previous session): fetch a fresh one and retry once.
    if (response?.status === 403 && response.data?.code === 'EBADCSRFTOKEN' && config && !config._csrfRetried) {
      csrfToken = null
      config._csrfRetried = true
      return api(config)
    }
    if (response?.status === 429 && response.data && !response.data.message) {
      response.data.message = 'Too many requests, please slow down and try again shortly.'
    }
    if (matches(config?.url, SESSION_CHANGING)) csrfToken = null
    return Promise.reject(error)
  }
)
