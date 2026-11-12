import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request. Because cookies alone can be forged cross-site, every
// state-changing request also carries an anti-CSRF token in the x-csrf-token
// header — something an attacker's page can neither read nor set.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes are exempt on the server, so no token is needed for them.
const EXEMPT_URLS = ['/auth/login', '/auth/register']

let csrfToken = null

async function getCsrfToken() {
  if (!csrfToken) {
    const res = await api.get('/csrf-token')
    csrfToken = res.data.csrfToken
  }
  return csrfToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (SAFE_METHODS.includes(method) || EXEMPT_URLS.some((u) => url.includes(u))) {
    return config
  }
  config.headers['x-csrf-token'] = await getCsrfToken()
  return config
})

// The token is bound to the session, so drop the cached one whenever the
// session changes (login / register / logout) and fetch a fresh one next time.
api.interceptors.response.use((response) => {
  const url = response.config?.url || ''
  if (url.includes('/auth/')) csrfToken = null
  return response
})
