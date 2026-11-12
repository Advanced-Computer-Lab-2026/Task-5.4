import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. Because the browser would also send it on requests
// triggered by a different site, every state-changing request additionally
// carries an anti-CSRF token in the `x-csrf-token` header (see below).
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']

// The CSRF token is kept in memory only (never in localStorage).
let csrfToken = null

async function getCsrfToken() {
  if (!csrfToken) {
    const res = await api.get('/csrf-token')
    csrfToken = res.data.csrfToken
  }
  return csrfToken
}

// Attach the CSRF token to every state-changing request.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (SAFE_METHODS.includes(method)) return config

  // Login / register / logout run before (or end) a session, so they need no
  // token. They also change the session, so forget the old token.
  if ((config.url || '').startsWith('/auth/')) {
    csrfToken = null
    return config
  }

  config.headers['x-csrf-token'] = await getCsrfToken()
  return config
})

// If the token was rejected (e.g. it belonged to an earlier session), fetch a
// fresh one and retry the request once.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config
    const isCsrfError =
      error.response?.status === 403 &&
      error.response?.data?.message === 'Invalid CSRF token'

    if (isCsrfError && config && !config._csrfRetried) {
      config._csrfRetried = true
      csrfToken = null
      return api(config)
    }
    return Promise.reject(error)
  }
)
