import axios from 'axios'

// Cookies authenticate the session; the header proves intent for writes.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const path = (config.url || '').split('?')[0]
  if (!['get', 'head', 'options'].includes(method) &&
      !['/auth/login', '/auth/register'].includes(path)) {
    // Fetch for each write so login, logout and session changes never reuse a
    // token from another session. Safe GETs do not enter this branch.
    const { data } = await api.get('/csrf-token')
    config.headers['x-csrf-token'] = data.csrfToken
  }
  return config
})
