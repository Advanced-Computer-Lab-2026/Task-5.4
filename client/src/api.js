import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. Because the browser does that for requests fired by
// ANY site, the cookie alone proves nothing — so every state-changing request
// also carries an anti-CSRF token that only our own origin can obtain.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes are exempt on the server: no session exists yet.
const EXEMPT_URLS = ['/auth/login', '/auth/register']

// The token lives in memory only. It is bound to the current session, so it
// must be dropped whenever the session changes (login, register, logout).
let csrfTokenPromise = null

export function resetCsrfToken() {
  csrfTokenPromise = null
}

function getCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(res => res.data.csrfToken)
      .catch(err => { csrfTokenPromise = null; throw err })
  }
  return csrfTokenPromise
}

// Attach the token to every mutating request.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (SAFE_METHODS.includes(method) || EXEMPT_URLS.some(u => url.includes(u))) return config

  config.headers.set('x-csrf-token', await getCsrfToken())
  return config
})

// If the server rejects the token (e.g. it went stale because the session
// changed in another tab), fetch a fresh one and retry the request once.
api.interceptors.response.use(undefined, async (error) => {
  const config = error.config
  const rejected = error.response?.status === 403 && error.response?.data?.code === 'EBADCSRFTOKEN'
  if (!rejected || !config || config._csrfRetried) throw error

  config._csrfRetried = true
  resetCsrfToken()
  return api.request(config)
})
