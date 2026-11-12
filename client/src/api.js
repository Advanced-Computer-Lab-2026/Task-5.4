import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// ---------------------------------------------------------------------------
// CSRF protection (double-submit cookie)
//
// The server only accepts a state-changing request when it carries an
// `x-csrf-token` header that matches the CSRF cookie set by GET /csrf-token.
// Our own UI can fetch and read that token. An attacker's site cannot: CORS
// stops it reading our responses, and a plain HTML form cannot add headers.
// ---------------------------------------------------------------------------
const MUTATING = new Set(['post', 'put', 'patch', 'delete'])

let csrfToken = null
let pending = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!pending) {
    pending = api.get('/csrf-token')
      .then(res => {
        csrfToken = res.data.csrfToken
        return csrfToken
      })
      .finally(() => { pending = null })
  }
  return pending
}

// The token is bound to the session, so drop it whenever the session changes.
export function clearCsrfToken() {
  csrfToken = null
}

const SESSION_CHANGING = /\/auth\/(login|register|logout)$/

// Attach the token to every mutating request.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (MUTATING.has(method)) {
    const token = await getCsrfToken()
    config.headers = config.headers || {}
    if (typeof config.headers.set === 'function') config.headers.set('x-csrf-token', token)
    else config.headers['x-csrf-token'] = token
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    // Login/register/logout start a new session, so the old token is stale.
    if (SESSION_CHANGING.test(res.config?.url || '')) clearCsrfToken()
    return res
  },
  async (error) => {
    const { config, response } = error
    // If the token was rejected (e.g. it expired or the session changed),
    // fetch a fresh one and retry the request once.
    const isCsrfError = response?.status === 403 &&
      /csrf/i.test(response?.data?.message || '')
    if (isCsrfError && config && !config._csrfRetried) {
      config._csrfRetried = true
      clearCsrfToken()
      return api(config)
    }
    return Promise.reject(error)
  }
)
