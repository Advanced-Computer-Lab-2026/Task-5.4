import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API (and the CSRF cookie the server sets).
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// CSRF fix: before every state-changing request, fetch a fresh anti-CSRF token
// from the server and echo it back in the `x-csrf-token` header.
//
// Only our own front end can do this: CORS lets http://localhost:5175 read the
// /csrf-token response, but the attacker's page cannot read it, and a plain
// HTML form cannot set custom headers. So forged requests arrive with no valid
// token and the server rejects them with 403.
//
// We fetch a fresh token each time (instead of caching one) because the token
// is tied to the login session; after login/logout the old token would no
// longer match.
const MUTATING_METHODS = ['post', 'put', 'patch', 'delete']

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (MUTATING_METHODS.includes(method)) {
    const { data } = await api.get('/csrf-token')
    if (typeof config.headers?.set === 'function') {
      config.headers.set('x-csrf-token', data.csrfToken)
    } else {
      config.headers = { ...config.headers, 'x-csrf-token': data.csrfToken }
    }
  }
  return config
})
