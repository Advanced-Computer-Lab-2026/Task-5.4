import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfPromise = null

// fetch a fresh CSRF token from the server and cache it
export function refreshCsrf() {
  csrfPromise = api
    .get('/csrf-token')
    .then(({ data }) => data.csrfToken)
    .catch((err) => {
      csrfPromise = null // allow a retry on the next request
      throw err
    })
  return csrfPromise
}

// before every state-changing request, attach the token
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    if (!csrfPromise) refreshCsrf()
    config.headers['x-csrf-token'] = await csrfPromise
  }
  return config
})

// after login / register / logout the auth cookie changes,
// so fetch a new CSRF token that matches it
api.interceptors.response.use((response) => {
  const url = response.config.url || ''
  if (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/logout')
  ) {
    refreshCsrf().catch(() => {})
  }
  return response
})