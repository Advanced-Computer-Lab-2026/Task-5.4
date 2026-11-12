import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Anti-CSRF: before every state-changing request (POST/PUT/PATCH/DELETE), fetch a
// fresh CSRF token and send it in the x-csrf-token header. A fresh token each time
// avoids using a stale one after login/register (the token is tied to the session).
const SAFE_METHODS = ['get', 'head', 'options']

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (SAFE_METHODS.includes(method)) return config

  const { data } = await api.get('/csrf-token')
  config.headers['x-csrf-token'] = data.csrfToken
  return config
})
