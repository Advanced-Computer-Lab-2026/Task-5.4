import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and the
// CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// ---------------------------------------------------------------------------
// CSRF protection (double-submit cookie, server side uses csrf-csrf).
//
// The cookie alone is no proof a request came from our UI, since the browser
// attaches it to requests triggered by ANY site. So for every state-changing
// request we also send a secret token in the `x-csrf-token` header. Only our own
// pages can read that token (from GET /csrf-token); an attacker's page can't read
// it and a plain HTML form can't set custom headers.
// ---------------------------------------------------------------------------

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes: no session exists yet, so the server doesn't require a token.
const PRE_AUTH = ['/auth/login', '/auth/register']
// Routes that change the session (and therefore which token is valid).
const SESSION_CHANGING = ['/auth/login', '/auth/register', '/auth/logout']

let csrfToken = null

async function fetchCsrfToken() {
  const res = await api.get('/csrf-token')
  csrfToken = res.data.csrfToken
  return csrfToken
}

const matches = (url, list) => list.some(p => (url || '').includes(p))

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (SAFE_METHODS.includes(method) || matches(config.url, PRE_AUTH)) return config

  const token = csrfToken || await fetchCsrfToken()
  if (typeof config.headers?.set === 'function') config.headers.set('x-csrf-token', token)
  else config.headers = { ...config.headers, 'x-csrf-token': token }
  return config
})

api.interceptors.response.use(
  (res) => {
    // The token is bound to the session, so drop it once the session changes.
    if (matches(res.config?.url, SESSION_CHANGING)) csrfToken = null
    return res
  },
  async (error) => {
    const { config, response } = error
    // A stale token (e.g. the session expired) — fetch a fresh one and retry once.
    if (response?.status === 403 && /csrf/i.test(response.data?.message || '') && config && !config._csrfRetried) {
      config._csrfRetried = true
      csrfToken = null
      return api(config)
    }
    return Promise.reject(error)
  }
)
