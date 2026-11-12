import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE_METHODS = ['get', 'head', 'options']
// Pre-auth routes are exempt on the server, so no token is needed.
const EXEMPT_URLS = ['/auth/login', '/auth/register']

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (SAFE_METHODS.includes(method) || EXEMPT_URLS.some((u) => url.includes(u))) {
    return config
  }

  const { data } = await api.get('/csrf-token')
  if (typeof config.headers.set === 'function') {
    config.headers.set('x-csrf-token', data.csrfToken)
  } else {
    config.headers['x-csrf-token'] = data.csrfToken
  }
  return config
})
