import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// ---- CSRF protection ------------------------------------------------------
// The server requires an anti-CSRF token in the `x-csrf-token` header on every
// state-changing request. Only our own origin can obtain it (CORS stops other
// sites from reading GET /csrf-token), so a forged cross-site request has no
// token and is rejected with 403.

const MUTATING_METHODS = ['post', 'put', 'patch', 'delete']
// Pre-auth routes are exempt on the server — no session exists yet.
const CSRF_EXEMPT = ['/auth/login', '/auth/register']
// Routes that change the session; the token is bound to the session, so after
// any of these the cached token is stale and must be refetched.
const SESSION_CHANGING = ['/auth/login', '/auth/register', '/auth/logout']

let csrfToken = null
let pendingTokenRequest = null

function matches(url, list) {
  return list.some(path => (url || '').endsWith(path))
}

// Fetch (once, de-duplicated across concurrent requests) and cache the token.
async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!pendingTokenRequest) {
    pendingTokenRequest = api.get('/csrf-token')
      .then(res => {
        csrfToken = res.data.csrfToken
        return csrfToken
      })
      .finally(() => { pendingTokenRequest = null })
  }
  return pendingTokenRequest
}

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  if (MUTATING_METHODS.includes(method) && !matches(config.url, CSRF_EXEMPT)) {
    config.headers.set('x-csrf-token', await getCsrfToken())
  }
  return config
})

api.interceptors.response.use(
  res => {
    if (matches(res.config.url, SESSION_CHANGING)) csrfToken = null
    return res
  },
  async error => {
    const { config, response } = error
    // The token may have expired or belong to an old session: refetch it and
    // retry the request exactly once.
    if (
      response?.status === 403 &&
      /csrf/i.test(response.data?.message || '') &&
      config && !config._csrfRetried
    ) {
      config._csrfRetried = true
      csrfToken = null
      return api(config)
    }
    return Promise.reject(error)
  }
)
