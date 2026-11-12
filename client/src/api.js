import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie (and
// the CSRF cookie) on every request to the API.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']

// The token is bound to the auth cookie, so one fetched before login (or by a
// different user) is useless afterwards. Fetching a fresh token right before
// each write is the simplest way to always have a valid one; it costs one
// extra small GET per write, which is fine for this app.
async function fetchCsrfToken() {
  const res = await api.get('/csrf-token')
  return res.data.csrfToken
}

// Attach the token as `x-csrf-token` on every state-changing request. A forged
// cross-site <form> can't do this: it can't read the token or set headers.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!SAFE_METHODS.includes(method)) {
    const token = await fetchCsrfToken()
    config.headers.set
      ? config.headers.set('x-csrf-token', token)
      : (config.headers['x-csrf-token'] = token)
  }
  return config
})
