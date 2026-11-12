import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// --- CSRF ---------------------------------------------------------------
// The cookie alone proves nothing (the browser sends it for any site), so each
// state-changing request also carries a CSRF token in the `x-csrf-token`
// header. Only our own origin can read that token from GET /csrf-token.
const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes: no session exists yet, so the server exempts them.
const EXEMPT_URLS = ['/auth/login', '/auth/register']

let csrfToken = null

// The token is bound to the session, so drop it whenever the session changes.
export function clearCsrfToken() {
  csrfToken = null
}

async function getCsrfToken() {
  if (!csrfToken) {
    const res = await api.get('/csrf-token')
    csrfToken = res.data.csrfToken
  }
  return csrfToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (!SAFE_METHODS.includes(method) && !EXEMPT_URLS.some((u) => url.includes(u))) {
    config.headers.set('x-csrf-token', await getCsrfToken())
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    // Logging in/out/registering changes the session → the old token is stale.
    const url = res.config?.url || ''
    if (url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/logout')) {
      clearCsrfToken()
    }
    return res
  },
  async (error) => {
    // A stale token (e.g. the session changed in another tab) gives a 403:
    // fetch a fresh token and retry the request once.
    const config = error.config
    if (error.response?.status === 403 && error.response?.data?.code === 'EBADCSRFTOKEN' && config && !config._csrfRetried) {
      config._csrfRetried = true
      clearCsrfToken()
      return api(config)
    }
    return Promise.reject(error)
  }
)
