import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Auth cookies are attached by the browser. For every write after a session
// exists, pair that cookie with a token returned only to this same-origin app.
api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  if (['get', 'head', 'options'].includes(method)) return config
  if (/^\/auth\/(login|register)(\?|$)/.test(config.url || '')) return config

  const { data } = await api.get('/maintenance/csrf-token')
  config.headers = config.headers || {}
  config.headers['x-csrf-token'] = data.csrfToken
  return config
})
