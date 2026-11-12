import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. Because the cookie alone is not proof that a
// request came from our UI, every state-changing request also carries an
// anti-CSRF token in the `x-csrf-token` header (which other sites cannot read
// or forge).
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes are exempt on the server, so no token is needed for them.
const CSRF_EXEMPT_URLS = ['/auth/login', '/auth/register']

let csrfToken = null
let csrfTokenPromise = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(res => { csrfToken = res.data.csrfToken; return csrfToken })
      .finally(() => { csrfTokenPromise = null })
  }
  return csrfTokenPromise
}

// The token is bound to the session, so drop it whenever the session changes
// (login, register, logout). The next write fetches a fresh one.
export function resetCsrfToken() {
  csrfToken = null
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method) && !CSRF_EXEMPT_URLS.includes(config.url)) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})
