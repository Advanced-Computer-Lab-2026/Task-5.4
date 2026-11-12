import axios from 'axios'

// The auth cookie is sent automatically. The interceptor below adds the
// separate anti-CSRF proof required for authenticated state-changing requests.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken = null
let csrfTokenRequest = null

const protectedWrite = (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  const isMutation = ['post', 'patch', 'put', 'delete'].includes(method)
  const isPreAuth = url.includes('/auth/login') || url.includes('/auth/register')
  return isMutation && !isPreAuth && !url.includes('/csrf-token')
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfTokenRequest) {
    csrfTokenRequest = api.get('/csrf-token')
      .then(({ data }) => {
        csrfToken = data.csrfToken
        return csrfToken
      })
      .finally(() => { csrfTokenRequest = null })
  }
  return csrfTokenRequest
}

api.interceptors.request.use(async (config) => {
  if (!protectedWrite(config)) return config
  const token = await getCsrfToken()
  config.headers = config.headers || {}
  config.headers['x-csrf-token'] = token
  return config
})

export function clearCsrfToken() {
  csrfToken = null
}
