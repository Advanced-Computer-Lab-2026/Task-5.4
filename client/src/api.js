import axios from 'axios'

// The session and CSRF cookies stay httpOnly. Read the CSRF token from the
// authenticated JSON endpoint and echo it explicitly on each write.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Share concurrent token fetches, but do not cache across session changes.
let pendingToken
api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const path = (config.url || '').split('?')[0]
  if (['get', 'head', 'options'].includes(method) ||
      (method === 'post' && ['/auth/login', '/auth/register'].includes(path))) return config

  if (!pendingToken) {
    pendingToken = api.get('/csrf-token')
      .then(res => res.data.csrfToken)
      .finally(() => { pendingToken = undefined })
  }
  config.headers['x-csrf-token'] = await pendingToken
  return config
})
