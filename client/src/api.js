import axios from 'axios'

// Cookies authenticate the session; a separate header proves intent on writes.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfRequest

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const preAuth = method === 'post' && ['/auth/login', '/auth/register'].includes(config.url)
  if (!['get', 'head', 'options'].includes(method) && !preAuth) {
    // Fetch for each write so login changes and other tabs cannot leave a
    // cached token bound to an old session. The server reuses a valid cookie.
    csrfRequest ||= api.get('/csrf-token').finally(() => { csrfRequest = undefined })
    const { data } = await csrfRequest
    config.headers.set('x-csrf-token', data.csrfToken)
  }
  return config
})
