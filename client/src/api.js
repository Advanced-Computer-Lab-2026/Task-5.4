import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = new Set(['get', 'head', 'options'])
const PRE_AUTH_PATHS = ['/auth/login', '/auth/register']
let csrfTokenPromise = null

function isPreAuthRequest(url = '') {
  const path = url.split('?')[0]
  return PRE_AUTH_PATHS.some(route => path.endsWith(route))
}

async function getCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(response => response.data.csrfToken)
      .catch(error => {
        csrfTokenPromise = null
        throw error
      })
  }
  return csrfTokenPromise
}

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  if (SAFE_METHODS.has(method) || isPreAuthRequest(config.url)) return config

  const csrfToken = await getCsrfToken()
  config.headers.set('x-csrf-token', csrfToken)
  return config
})

// A successful login, registration, or logout changes the JWT session to
// which the CSRF token is bound, so the next write must obtain a fresh token.
api.interceptors.response.use(response => {
  const url = response.config?.url || ''
  if (isPreAuthRequest(url) || url.split('?')[0].endsWith('/auth/logout')) {
    csrfTokenPromise = null
  }
  return response
})
