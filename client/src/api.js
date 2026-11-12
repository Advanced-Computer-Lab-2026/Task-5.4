import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// --- CSRF token management ---
//
// How the double-submit-cookie pattern works here:
//
//   1. Before the first mutating request, we call GET /api/csrf-token. The
//      server generates a secret, stores it in a signed httpOnly cookie, and
//      returns a token derived from that secret in the JSON body.
//
//   2. We cache the token in memory (a module-level variable). It is good for
//      the lifetime of this page load. If the server ever rejects it (403) we
//      could refresh it, but for this app a simple cache is enough.
//
//   3. On every POST, PATCH, or DELETE we echo the token back in the
//      x-csrf-token header. The server re-derives the expected token from the
//      signed cookie and compares. They match → request proceeds. They don't
//      match (or the header is absent, as in a forged cross-site request) → 403.
//
//   An attacker's forged form/fetch can carry the victim's auth cookie (the
//   browser sends it automatically) but cannot read the CSRF cookie (httpOnly)
//   and therefore cannot know the token. The header is absent → 403.

let csrfTokenCache = null

export function clearCsrfToken() {
  csrfTokenCache = null
}

async function getCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache
  const res = await api.get('/csrf-token')
  csrfTokenCache = res.data.csrfToken
  return csrfTokenCache
}

// Axios request interceptor: runs before every outgoing request.
// For state-changing methods only, fetch the CSRF token and attach it as a
// header. GET requests are left untouched (they are read-only and exempt).
const MUTATING_METHODS = new Set(['post', 'patch', 'put', 'delete'])

api.interceptors.request.use(async (config) => {
  const method = (config.method || '').toLowerCase()
  // Skip token injection for the csrf-token endpoint itself to avoid recursion.
  const isCsrfEndpoint = (config.url || '').includes('/csrf-token')

  if (MUTATING_METHODS.has(method) && !isCsrfEndpoint) {
    const token = await getCsrfToken()
    config.headers = config.headers || {}
    config.headers['x-csrf-token'] = token
  }
  return config
})

// Axios response interceptor: if a request is rejected with 403 (invalid CSRF token),
// reset the cached token so the next attempt fetches a fresh one.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 403) {
      csrfTokenCache = null
    }
    return Promise.reject(error)
  }
)

