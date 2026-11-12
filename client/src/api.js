import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. On its own that's the precondition for CSRF — so
// every state-changing request must also carry an anti-CSRF token in a header
// the attacker's page cannot set.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Cached CSRF token. We fetch it once from /csrf-token (which also sets the
// httpOnly double-submit cookie), then echo it back on every mutating request.
let csrfToken = null

async function fetchCsrfToken() {
  if (csrfToken) return csrfToken
  const res = await api.get('/csrf-token')
  csrfToken = res.data.csrfToken
  return csrfToken
}

// Attach the token to every state-changing request (POST / PUT / PATCH / DELETE).
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = await fetchCsrfToken()
    config.headers = config.headers || {}
    config.headers['x-csrf-token'] = token
  }
  return config
})

// Drop the cached token when the session ends or a token is rejected, so the
// next user/session gets a fresh one.
api.interceptors.response.use(
  (res) => {
    if ((res.config?.url || '').includes('/auth/logout')) csrfToken = null
    return res
  },
  (err) => {
    if (err.response?.status === 403) csrfToken = null
    return Promise.reject(err)
  }
)