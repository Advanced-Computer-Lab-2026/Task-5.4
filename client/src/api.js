import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const safeMethods = new Set(['get', 'head', 'options'])
const preAuthPaths = new Set(['/auth/login', '/auth/register'])
let tokenRequest

api.interceptors.request.use(async config => {
  if (safeMethods.has(config.method) ||
      (config.method === 'post' && preAuthPaths.has(config.url))) {
    return config
  }

  // Share concurrent token fetches so the first writes use the same cookie.
  tokenRequest ??= api.get('/auth/csrf-token').finally(() => { tokenRequest = undefined })
  const { data } = await tokenRequest
  config.headers.set('X-CSRF-Token', data.csrfToken)
  return config
})
