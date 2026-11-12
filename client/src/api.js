import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. Because the browser also does that for requests
// triggered by other sites, the cookie alone proves nothing — so every
// state-changing request additionally carries a CSRF token in a header, which
// only our own origin can obtain (CORS stops other sites reading it).
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// These run before a session exists; the server exempts them too.
const PRE_AUTH = ['/auth/login', '/auth/register']
// The token is bound to the session, so it is stale once the session changes.
const SESSION_CHANGING = [...PRE_AUTH, '/auth/logout']

const matches = (url, paths) => paths.some(p => (url || '').includes(p))

let csrfTokenPromise = null

function getCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(res => res.data.csrfToken)
      .catch(err => { csrfTokenPromise = null; throw err })
  }
  return csrfTokenPromise
}

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method) && !matches(config.url, PRE_AUTH)) {
    config.headers.set('x-csrf-token', await getCsrfToken())
  }
  return config
})

api.interceptors.response.use(
  res => {
    if (matches(res.config.url, SESSION_CHANGING)) csrfTokenPromise = null
    return res
  },
  async err => {
    const config = err.config
    // A rejected token (e.g. the server restarted or the session changed in
    // another tab): fetch a fresh one and retry the request once.
    if (err.response?.status === 403 && config?.headers?.get?.('x-csrf-token') && !config._csrfRetried) {
      config._csrfRetried = true
      csrfTokenPromise = null
      return api(config)
    }
    throw err
  }
)
