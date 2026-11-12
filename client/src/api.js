import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. On its own that would leave the app open to CSRF,
// so every state-changing request also carries an anti-CSRF token in the
// `x-csrf-token` header — a second proof that the request came from our own UI.
// A forged request from another site can't set that header and can't read the
// token (CORS blocks it from reading /csrf-token), so the server rejects it.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']

// The token is bound to the current session, so it's cached here and dropped
// whenever the session changes (login / register / logout).
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

export function resetCsrfToken() {
  csrfToken = null
}

// Attach the CSRF token to every mutating request (safe methods are exempt).
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method)) {
    const token = await getCsrfToken()
    config.headers.set
      ? config.headers.set('x-csrf-token', token)
      : (config.headers['x-csrf-token'] = token)
  }
  return config
})

// If the token went stale (e.g. the session changed in another tab), fetch a
// fresh one and retry the request once.
api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error
  if (response?.status === 403 && response.data?.code === 'EBADCSRFTOKEN' && config && !config._csrfRetried) {
    config._csrfRetried = true
    resetCsrfToken()
    return api(config)
  }
  return Promise.reject(error)
})
