import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. On its own that would leave the app open to CSRF,
// so every state-changing request also carries an anti-CSRF token in the
// `x-csrf-token` header. A forged request from another site cannot read that
// token (CORS blocks reading our responses) and a plain HTML form cannot set
// custom headers, so the server rejects it with 403.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const CSRF_HEADER = 'x-csrf-token'
const SAFE_METHODS = new Set(['get', 'head', 'options'])
// These change the session, and the token is bound to the session.
const SESSION_CHANGING = /\/auth\/(login|register|logout)$/

let csrfToken = null
let pendingToken = null

// Fetch (once, shared by concurrent requests) and cache the CSRF token.
function getCsrfToken() {
  if (csrfToken) return Promise.resolve(csrfToken)
  if (!pendingToken) {
    pendingToken = api.get('/csrf-token')
      .then(res => { csrfToken = res.data.csrfToken; return csrfToken })
      .finally(() => { pendingToken = null })
  }
  return pendingToken
}

function setHeader(config, name, value) {
  if (config.headers && typeof config.headers.set === 'function') config.headers.set(name, value)
  else config.headers = { ...config.headers, [name]: value }
}

// Attach the token to every mutating request.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (SAFE_METHODS.has(method)) return config
  setHeader(config, CSRF_HEADER, await getCsrfToken())
  return config
})

api.interceptors.response.use(
  (res) => {
    // Logging in/out starts a new session, so the old token is no longer valid.
    if (SESSION_CHANGING.test(res.config?.url || '')) csrfToken = null
    return res
  },
  async (error) => {
    const config = error.config
    // The token went stale (session changed or expired): get a new one and retry once.
    if (error.response?.status === 403 && error.response.data?.code === 'EBADCSRFTOKEN' && config && !config._csrfRetried) {
      config._csrfRetried = true
      csrfToken = null
      return api(config)
    }
    return Promise.reject(error)
  }
)
