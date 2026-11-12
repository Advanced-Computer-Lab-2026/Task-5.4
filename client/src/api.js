import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const safeMethods = ['get', 'head', 'options']
  const preAuthRoutes = ['/auth/login', '/auth/register']

  if (
    safeMethods.includes(method) ||
    (method === 'post' && preAuthRoutes.includes(config.url))
  ) {
    return config
  }

  const response = await api.get('/csrf-token')
  config.headers['x-csrf-token'] = response.data.csrfToken

  return config
})