import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. To prevent CSRF on state-changing requests, we
// fetch a per-session CSRF token from `/csrf-token` and attach it in the
// `x-csrf-token` header on every mutating request.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const MUTATING_METHODS = ['post', 'put', 'patch', 'delete']

api.interceptors.request.use(async (config) => {
  const method = (config.method || '').toLowerCase()
  if (MUTATING_METHODS.includes(method)) {
    const res = await api.get('/csrf-token')
    const csrfToken = res?.data?.csrfToken
    if (csrfToken) {
      config.headers = config.headers || {}
      if (typeof config.headers.set === 'function') {
        config.headers.set('x-csrf-token', csrfToken)
      } else {
        config.headers['x-csrf-token'] = csrfToken
      }
    }
  }
  return config
})
