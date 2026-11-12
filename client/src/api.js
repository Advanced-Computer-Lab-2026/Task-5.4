import axios from 'axios'

// `withCredentials: true` sends the httpOnly auth cookie on every request. Because
// the browser also sends it for requests triggered by other sites, every
// state-changing request must additionally carry a CSRF token (x-csrf-token).
// The attacker's page cannot read this token, so it cannot forge the header.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']

// Fetch a fresh token before each write. The token is bound to the current
// session, so it changes on login/logout; fetching per write avoids stale tokens.
api.interceptors.request.use(async (config) => {
  if (SAFE_METHODS.includes((config.method || 'get').toLowerCase())) return config
  const { data } = await api.get('/csrf-token')
  config.headers.set ? config.headers.set('x-csrf-token', data.csrfToken) : (config.headers['x-csrf-token'] = data.csrfToken)
  return config
})
