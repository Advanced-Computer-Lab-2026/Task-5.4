import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. That convenience is what exposes the app to CSRF —
// so every state-changing request now also carries an anti-CSRF token in the
// `x-csrf-token` header. The token is issued by `GET /api/csrf-token` (cookie +
// JSON body); an attacker's site can neither read that response nor set this
// header from a bare HTML form, so a forged write is impossible.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// The raw token from the server; never read from a cookie by page JS.
let csrfToken = null

export async function loadCsrfToken() {
  try {
    const res = await api.get('/csrf-token')
    csrfToken = res.data.csrfToken
  } catch {
    // Server unreachable or route missing — leave the token unset; the next
    // mutating request will retry.
  }
  return csrfToken
}

// Attach the token to every mutating request (GET/HEAD/OPTIONS are safe).
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method)) {
    if (!csrfToken) await loadCsrfToken()
    if (csrfToken) config.headers['x-csrf-token'] = csrfToken
  }
  return config
})

// If the server ever invalidates the token (expiry/rotation), fetch a fresh
// one once and retry the request.
api.interceptors.response.use(
  undefined,
  async (error) => {
    const config = error.config
    if (error.response?.status === 403 && config && !config.__csrfRetried) {
      config.__csrfRetried = true
      await loadCsrfToken()
      if (csrfToken) {
        config.headers['x-csrf-token'] = csrfToken
        return api(config)
      }
    }
    return Promise.reject(error)
  }
)

// Warm up the token as soon as the app loads.
loadCsrfToken()
