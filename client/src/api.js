import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const preAuth = ['/auth/login', '/auth/register'].includes(config.url)
  if (!['get', 'head', 'options'].includes(method) && !preAuth) {
    // Fetch for the current session each time, including after login or reload.
    // The GET is safe and therefore does not recurse into this branch.
    const { data } = await api.get('/csrf-token')
    config.headers['x-csrf-token'] = data.csrfToken
  }
  return config
})
