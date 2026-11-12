
import axios from 'axios'


export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken = null

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''

  const isWriteRequest = ['post', 'put', 'patch', 'delete'].includes(method)
  const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/register')

  if (isWriteRequest && !isAuthRequest) {
    if (!csrfToken) {
      const response = await api.get('/auth/csrf-token')
      csrfToken = response.data.csrfToken
    }

    config.headers.set('X-CSRF-Token', csrfToken)
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    const url = response.config.url || ''

    if (url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/logout')) {
      csrfToken = null
    }

    return response
  },
  (error) => {
    if (error.response?.status === 403) {
      csrfToken = null
    }

    return Promise.reject(error)
  }
)
