import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const writeMethods = new Set(['post', 'put', 'patch', 'delete'])
let pendingCsrfToken

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const path = (config.url || '').split('?')[0].replace(/\/+$/, '')
  const isPreAuth = /(?:^|\/)auth\/(?:login|register)$/.test(path)

  if (!writeMethods.has(method) || isPreAuth) {
    return config
  }

  if (!pendingCsrfToken) {
    pendingCsrfToken = api.get('/auth/csrf-token')
      .then(({ data }) => data.csrfToken)
      .finally(() => {
        pendingCsrfToken = undefined
      })
  }

  config.headers['X-CSRF-Token'] = await pendingCsrfToken
  return config
})