import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API. The cookie alone no longer
// authorises a write, though: every state-changing request must also carry the
// anti-CSRF token in the `x-csrf-token` header. Only our own UI can do that —
// an attacker's page can neither read the token nor add the header to a forged
// HTML form POST.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

export const CSRF_HEADER = 'x-csrf-token'

// Methods that never change state and therefore never need a token.
const SAFE_METHODS = new Set(['get', 'head', 'options'])

// Routes that run before a session exists (the server exempts them too).
const PRE_AUTH_PATHS = ['/auth/login', '/auth/register']

// Routes that start or end a session. The CSRF token is bound to the session,
// so after any of these the cached token is stale and must be fetched again.
const SESSION_CHANGING_PATHS = [...PRE_AUTH_PATHS, '/auth/logout']

let csrfToken = null
let pendingTokenRequest = null

function matchesPath(url, paths) {
  const path = (url || '').split('?')[0]
  return paths.some(p => path.endsWith(p))
}

function needsCsrfToken(config) {
  const method = (config.method || 'get').toLowerCase()
  return !SAFE_METHODS.has(method) && !matchesPath(config.url, PRE_AUTH_PATHS)
}

function isCsrfFailure(error) {
  return error?.response?.status === 403 && error.response.data?.code === 'EBADCSRFTOKEN'
}

// Fetch the token once and share it between concurrent writes.
export async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!pendingTokenRequest) {
    pendingTokenRequest = api.get('/csrf-token')
      .then(res => {
        csrfToken = res.data.csrfToken
        return csrfToken
      })
      .finally(() => { pendingTokenRequest = null })
  }
  return pendingTokenRequest
}

export function clearCsrfToken() {
  csrfToken = null
}

// Attach the token to every mutating request.
api.interceptors.request.use(async config => {
  if (needsCsrfToken(config)) {
    config.headers.set(CSRF_HEADER, await getCsrfToken())
  }
  return config
})

api.interceptors.response.use(
  res => {
    if (matchesPath(res.config?.url, SESSION_CHANGING_PATHS)) clearCsrfToken()
    return res
  },
  async error => {
    const config = error.config
    // The token went stale (e.g. the session changed in another tab): fetch a
    // fresh one and retry the request once.
    if (isCsrfFailure(error) && config && !config._csrfRetried) {
      clearCsrfToken()
      config._csrfRetried = true
      return api.request(config)
    }
    return Promise.reject(error)
  }
)
