import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Automatically attach CSRF token to state-changing requests
api.interceptors.request.use(async (config) => {

  const method = (config.method || 'get').toLowerCase()

  // GET, HEAD and OPTIONS do not need CSRF tokens
  if (['get', 'head', 'options'].includes(method)) {
    return config
  }

  // Login and registration do not yet have a session
  if (
    config.url === '/auth/login' ||
    config.url === '/auth/register'
  ) {
    return config
  }

  // Request a CSRF token
  const response = await api.get('/csrf-token')

  const csrfToken = response.data.csrfToken

  // Attach the token to the original request
  config.headers.set('x-csrf-token', csrfToken)

  return config
})