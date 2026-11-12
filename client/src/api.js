import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. Because the browser would also send it on requests
// triggered by another site, every state-changing request additionally carries
// an anti-CSRF token in the `x-csrf-token` header — something an attacker's
// page can neither read nor set.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// login/register run before a session exists; the server does not check them.
const isPreAuth = (url = '') => url.includes('/auth/login') || url.includes('/auth/register')
const changesSession = (url = '') => url.includes('/auth/')

// The token is bound to the current session, so it is cached and dropped
// whenever the session changes (login / register / logout).
let csrfToken = null

async function getCsrfToken() {
  if (!csrfToken) {
    // Use the same instance (and adapter) so cookies ride along.
    const res = await api.get('/csrf-token')
    csrfToken = res.data.csrfToken
  }
  return csrfToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method) && !isPreAuth(config.url)) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (changesSession(res.config?.url) && (res.config?.method || '').toLowerCase() === 'post') {
      csrfToken = null
    }
    return res
  },
  async (error) => {
    const config = error.config
    // A stale token (e.g. the session changed in another tab) gets one retry
    // with a freshly fetched token.
    if (error.response?.status === 403 && config && !config._csrfRetried &&
        /csrf/i.test(error.response?.data?.message || '')) {
      config._csrfRetried = true
      csrfToken = null
      config.headers['x-csrf-token'] = await getCsrfToken()
      return api(config)
    }
    return Promise.reject(error)
  }
)
