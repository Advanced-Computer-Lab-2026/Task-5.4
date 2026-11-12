import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let pendingTokenRequest

function getCsrfToken() {
  // Share concurrent token requests so first-time writes cannot race to set
  // different cookies. Do not retain tokens across authentication changes.
  if (!pendingTokenRequest) {
    pendingTokenRequest = api.get('/csrf-token')
      .then(({ data }) => {
        if (!data.csrfToken) throw new Error('Could not obtain a CSRF token')
        return data.csrfToken
      })
      .finally(() => { pendingTokenRequest = undefined })
  }
  return pendingTokenRequest
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const path = (config.url || '').split('?')[0].replace(/\/$/, '')
  const isPreAuth = method === 'post' &&
    ['/auth/login', '/auth/register'].includes(path)

  if (!['get', 'head', 'options'].includes(method) && !isPreAuth) {
    const token = await getCsrfToken()
    config.headers = config.headers || {}
    config.headers['x-csrf-token'] = token
  }
  return config
})
