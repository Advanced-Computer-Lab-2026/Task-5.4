import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// ── CSRF token handling ───────────────────────────────────────────────────────
// We fetch a CSRF token from the server once and cache it. Every mutating
// request (POST / PATCH / DELETE) sends it in the x-csrf-token header.
// An attacker's page cannot read our cookies to replicate this header, so
// forged cross-site requests are rejected with 403.
let csrfToken = null

async function fetchCsrfToken() {
  const { data } = await api.get('/csrf-token')
  csrfToken = data.csrfToken
  return csrfToken
}

// Attach the token to all state-changing requests
api.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    if (!csrfToken) await fetchCsrfToken()
    config.headers['x-csrf-token'] = csrfToken
  }
  return config
})

// If the server rejects with 403 (token expired / rotated), refresh and retry once
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 403 && !err.config._csrfRetry) {
      err.config._csrfRetry = true
      csrfToken = null
      await fetchCsrfToken()
      err.config.headers['x-csrf-token'] = csrfToken
      return api(err.config)
    }
    return Promise.reject(err)
  }
)
