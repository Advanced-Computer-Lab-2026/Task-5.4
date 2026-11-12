import axios from 'axios'

const apiBase = new URL('http://localhost:4000/api')
export const api = axios.create({
  baseURL: apiBase.href,
  withCredentials: true
})

const safeMethods = new Set(['get', 'head', 'options'])
const preAuthPaths = new Set(['/api/auth/login', '/api/auth/register'])
let pendingCsrfToken

api.interceptors.request.use(async (config) => {
  const method = config.method.toLowerCase()
  if (safeMethods.has(method)) return config

  const url = new URL(api.getUri(config))
  if (url.origin !== apiBase.origin || !url.pathname.startsWith(`${apiBase.pathname}/`)) return config
  if (method === 'post' && preAuthPaths.has(url.pathname)) return config

  // Share concurrent lookups, but fetch again on the next write so a changed
  // session (including a login in another tab) never reuses a cached token.
  pendingCsrfToken ??= api.get('/csrf-token')
    .then(({ data }) => {
      if (!data.csrfToken) throw new Error('The API did not return a CSRF token')
      return data.csrfToken
    })
    .finally(() => { pendingCsrfToken = undefined })
  config.headers.set('x-csrf-token', await pendingCsrfToken)
  return config
})
