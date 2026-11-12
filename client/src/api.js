import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const safeMethods = new Set(['get', 'head', 'options'])
const preAuthPaths = new Set(['/auth/login', '/auth/register'])
let pendingToken

api.interceptors.request.use(async config => {
  const method = config.method.toLowerCase()
  if (safeMethods.has(method) || (method === 'post' && preAuthPaths.has(config.url))) {
    return config
  }

  // Share an in-flight fetch so simultaneous writes use the same cookie.
  pendingToken ??= api.get('/csrf-token')
    .then(({ data }) => data.csrfToken)
    .finally(() => { pendingToken = undefined })
  config.headers.set('x-csrf-token', await pendingToken)
  return config
})
