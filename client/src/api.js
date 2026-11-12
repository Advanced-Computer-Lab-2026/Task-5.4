import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// --- Anti-CSRF token -------------------------------------------------------
// The server only accepts a state-changing request if it carries a valid
// x-csrf-token header. Our own UI can fetch that token (same-origin-allowed by
// CORS); an attacker's page cannot read it, so forged requests fail with 403.

const SAFE_METHODS = ['get', 'head', 'options']
// Auth calls change the session, so the token (bound to the session) must be
// re-fetched afterwards.
const SESSION_CHANGING = /\/auth\/(login|register|logout)/

let csrfToken = null

async function getCsrfToken() {
  if (!csrfToken) {
    const res = await api.get('/csrf-token')
    csrfToken = res.data.csrfToken
  }
  return csrfToken
}

function setHeader(config, name, value) {
  if (typeof config.headers?.set === 'function') config.headers.set(name, value)
  else config.headers = { ...config.headers, [name]: value }
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (!SAFE_METHODS.includes(method) && !url.includes('/csrf-token')) {
    setHeader(config, 'x-csrf-token', await getCsrfToken())
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (SESSION_CHANGING.test(res.config?.url || '')) csrfToken = null
    return res
  },
  async (error) => {
    const { config, response } = error
    // A stale token (e.g. the session changed) — fetch a fresh one and retry once.
    if (response?.status === 403 && response.data?.message === 'invalid csrf token' && config && !config._csrfRetried) {
      config._csrfRetried = true
      csrfToken = null
      return api(config)
    }
    return Promise.reject(error)
  }
)
