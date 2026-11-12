import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. On its own that is exactly what leaves the app open
// to CSRF, so every state-changing request must also carry an anti-CSRF token.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']

// Fetch a fresh, per-session anti-CSRF token. The server also sets it in an
// httpOnly cookie; we echo the value back in the `x-csrf-token` header below.
async function fetchCsrfToken() {
  const res = await api.get('/csrf-token')
  return res.data.csrfToken
}

// Attach the CSRF token to every state-changing request. Safe methods (and the
// token fetch itself) are skipped, so there is no recursion. The attacker's page
// cannot set this custom header on a cross-site request, which is what blocks
// the forgery.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method)) {
    const token = await fetchCsrfToken()
    if (typeof config.headers?.set === 'function') {
      config.headers.set('x-csrf-token', token)
    } else {
      config.headers = config.headers || {}
      config.headers['x-csrf-token'] = token
    }
  }
  return config
})
