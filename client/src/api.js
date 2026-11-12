import axios from 'axios'
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})
api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method) &&
      !/^\/auth\/(login|register)\/?$/.test(config.url || '')) {
    const { data } = await api.get('/csrf-token')
    config.headers['x-csrf-token'] = data.csrfToken
  }
  return config
})
