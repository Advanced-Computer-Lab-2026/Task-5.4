import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// --- CSRF protection (client side) ---
// The server now requires an anti-CSRF token on every state-changing request.
// We fetch the token once from GET /api/csrf-token (which also sets its cookie),
// cache it, and attach it as the `x-csrf-token` header on writes. Safe GETs and
// the pre-auth login/register routes don't need it, so we only add it to
// mutating methods. Our own site can read this token from the JSON response; an
// attacker's cross-site page cannot, which is what defeats the forged request.
let csrfToken = null
async function getCsrfToken() {
  if (!csrfToken) {
    const res = await api.get('/csrf-token')
    csrfToken = res.data.csrfToken
  }
  return csrfToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})
