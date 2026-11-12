import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. A cookie alone doesn't prove the request came from
// our UI, since the browser would attach it to a forged cross-site request too.
// So every state-changing request also carries an anti-CSRF token in the
// `x-csrf-token` header. An attacker's page can't read that token or set that header.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = new Set(['get', 'head', 'options'])
// Pre-auth routes are exempt on the server, and they change the session, so
// any cached token (bound to the old session) has to be dropped after them.
const SESSION_CHANGING = ['/auth/login', '/auth/register', '/auth/logout']

let csrfToken = null
let pending = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!pending) {
    pending = api.get('/csrf-token')
      .then(res => { csrfToken = res.data.csrfToken; return csrfToken })
      .finally(() => { pending = null })
  }
  return pending
}

export function clearCsrfToken() {
  csrfToken = null
}

const isSafe = (config) => SAFE_METHODS.has((config.method || 'get').toLowerCase())
const changesSession = (config) => SESSION_CHANGING.some(p => (config.url || '').includes(p))

// Attach the CSRF token to every mutating request.
api.interceptors.request.use(async (config) => {
  if (!isSafe(config)) {
    const token = await getCsrfToken()
    config.headers.set
      ? config.headers.set('x-csrf-token', token)
      : (config.headers['x-csrf-token'] = token)
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (changesSession(res.config)) clearCsrfToken()
    return res
  },
  async (error) => {
    const { config, response } = error
    // The token may be stale (for example, the session expired or changed in
    // another tab). Fetch a fresh one and retry once.
    if (response?.status === 403 && response.data?.code === 'EBADCSRFTOKEN' && config && !config._csrfRetried) {
      config._csrfRetried = true
      clearCsrfToken()
      return api(config)
    }
    if (config && changesSession(config)) clearCsrfToken()
    return Promise.reject(error)
  }
)
