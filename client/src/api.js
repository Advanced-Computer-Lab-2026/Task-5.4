import axios from 'axios'

// Cookies authenticate the session; the CSRF header proves intent on writes.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Fetch for each write so login/logout and other tabs cannot leave a cached
// token bound to an old session. Concurrent writes share the pending fetch.
let pendingToken
api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const path = (config.url || '').split('?')[0]
  if (['get', 'head', 'options'].includes(method) ||
      (method === 'post' && ['/auth/login', '/auth/register'].includes(path))) {
    return config
  }

  if (!pendingToken) {
    pendingToken = api.get('/csrf-token')
      .then(res => res.data.csrfToken)
      .finally(() => { pendingToken = null })
  }
  config.headers['x-csrf-token'] = await pendingToken
  return config
})
