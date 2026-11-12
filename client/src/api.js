import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. On its own that would leave us open to CSRF, so
// every state-changing request ALSO carries an anti-CSRF token in the
// `x-csrf-token` header. An attacker's page can neither read this token nor
// set this header on a forged form POST, so the server rejects its requests.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes run before a session exists; the server exempts them.
const CSRF_EXEMPT = ['/auth/login', '/auth/register']
// These change the session, so any cached token is stale afterwards.
const SESSION_CHANGING = ['/auth/login', '/auth/register', '/auth/logout']

let csrfToken = null

async function getCsrfToken() {
  if (!csrfToken) {
    const { data } = await api.get('/csrf-token')
    csrfToken = data.csrfToken
  }
  return csrfToken
}

const matches = (url, list) => list.some((p) => (url || '').includes(p))

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method) && !matches(config.url, CSRF_EXEMPT)) {
    const token = await getCsrfToken()
    config.headers = config.headers || {}
    if (typeof config.headers.set === 'function') config.headers.set('x-csrf-token', token)
    else config.headers['x-csrf-token'] = token
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (matches(res.config?.url, SESSION_CHANGING)) csrfToken = null
    return res
  },
  async (error) => {
    const config = error.config
    // The token may be stale (e.g. the session changed in another tab):
    // fetch a fresh one and retry the request once.
    if (error.response?.status === 403 && config && !config._csrfRetried &&
        /csrf/i.test(error.response?.data?.message || '')) {
      csrfToken = null
      config._csrfRetried = true
      return api(config)
    }
    return Promise.reject(error)
  }
)
