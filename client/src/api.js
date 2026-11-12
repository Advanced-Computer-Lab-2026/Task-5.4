import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API, including requests triggered by a different site.
// On its own that leaves the app open to CSRF, so every state-changing request
// now also carries an anti-CSRF token in the x-csrf-token header. A forged
// cross-site form can't read this token or set the header, so it gets rejected.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// ---- CSRF token handling ----
let csrfToken = null

// Fetch a fresh token from the server (call after login/register/logout,
// because the token is tied to the session cookie).
export async function refreshCsrfToken() {
  const { data } = await api.get('/csrf-token')
  csrfToken = data.csrfToken
}

// Attach the token to every request that changes data (POST/PATCH/PUT/DELETE).
// Safe methods (GET/HEAD/OPTIONS) don't need it.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method)) {
    if (!csrfToken) await refreshCsrfToken()
    config.headers['x-csrf-token'] = csrfToken
  }
  return config
})