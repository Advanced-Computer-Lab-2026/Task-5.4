import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. On its own that would leave the app open to CSRF,
// so every state-changing request also carries an anti-CSRF token in the
// `x-csrf-token` header — something a cross-site attacker cannot read or set.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']

// Before each write, fetch a fresh CSRF token and attach it. A fresh token is
// used every time because the token is bound to the auth cookie, which changes
// on login/register/logout.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method)) {
    const { data } = await api.get('/csrf-token')
    config.headers['x-csrf-token'] = data.csrfToken
  }
  return config
})
