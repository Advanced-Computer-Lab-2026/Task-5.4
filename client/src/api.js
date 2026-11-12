import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
let pendingCsrfToken

function getCsrfToken() {
  // Share concurrent token fetches, but fetch again for the next write so a
  // login change in this tab or another tab never leaves a cached session token.
  if (!pendingCsrfToken) {
    pendingCsrfToken = api.get('/csrf-token')
      .then(({ data }) => {
        if (typeof data.csrfToken !== 'string' || !data.csrfToken) {
          throw new Error('Could not obtain a CSRF token')
        }
        return data.csrfToken
      })
      .finally(() => { pendingCsrfToken = undefined })
  }
  return pendingCsrfToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase()
  const path = (config.url || '').split(/[?#]/)[0].replace(/\/+$/, '')
  const isPreAuth = method === 'POST' && /^\/auth\/(login|register)$/i.test(path)

  if (!safeMethods.has(method) && !isPreAuth) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})
