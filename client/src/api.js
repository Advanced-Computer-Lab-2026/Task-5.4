import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const safeMethods = new Set(['get', 'head', 'options'])
const preAuthPaths = new Set(['/auth/login', '/auth/register'])
const sessionPaths = new Set([...preAuthPaths, '/auth/logout'])
let csrfTokenPromise

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const path = (config.url || '').split('?')[0]

  if (safeMethods.has(method) || preAuthPaths.has(path)) return config

  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(res => {
        const token = res.data?.csrfToken
        if (typeof token !== 'string' || !token) {
          throw new Error('CSRF token endpoint returned no token')
        }
        return token
      })
      .catch(error => {
        csrfTokenPromise = undefined
        throw error
      })
  }

  const csrfToken = await csrfTokenPromise
  config.headers.set('x-csrf-token', csrfToken)
  return config
})

api.interceptors.response.use(response => {
  const path = (response.config.url || '').split('?')[0]
  if (sessionPaths.has(path)) csrfTokenPromise = undefined
  return response
})
