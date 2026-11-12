import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. To stop cross-site forgery, axios also copies the
// server-issued `csrfToken` cookie into the X-CSRF-Token header on each
// request; the server rejects unsafe requests where the two don't match.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true,
  xsrfCookieName: 'csrfToken',
  xsrfHeaderName: 'X-CSRF-Token'
})

const SAFE_METHODS = ['get', 'head', 'options']

// Before every state-changing request, ask the server for the current CSRF
// token and send it in the X-CSRF-Token header. Not cached on purpose: login
// and register issue a fresh token, so a stored one could go stale. The token
// fetch is a GET, so it skips this interceptor (no recursion).
api.interceptors.request.use(async (config) => {
  if (SAFE_METHODS.includes((config.method || 'get').toLowerCase())) return config
  const res = await api.get('/csrf-token')
  config.headers['X-CSRF-Token'] = res.data.csrfToken
  return config
})
