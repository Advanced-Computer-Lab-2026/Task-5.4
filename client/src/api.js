
import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Keep the CSRF token in memory, not localStorage.
let csrfToken = null
let csrfRequest = null

// Clear the cached token after login, logout or account changes.
export function clearCsrfToken() {
  csrfToken = null
  csrfRequest = null
}

// Obtain a token for the currently authenticated session.
export async function ensureCsrfToken() {
  if (csrfToken) return csrfToken

  // Share one request if several components need a token.
  if (!csrfRequest) {
    csrfRequest = api.get('/auth/csrf-token')
      .then(({ data }) => {
        if (typeof data.csrfToken !== 'string' ||
            !data.csrfToken) {
          throw new Error('CSRF token missing from response')
        }

        csrfToken = data.csrfToken
        return csrfToken
      })
      .finally(() => {
        csrfRequest = null
      })
  }

  return csrfRequest
}

// Attach CSRF tokens to authenticated write requests.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = (config.url || '').split('?')[0]

  const isWrite = ['post', 'put', 'patch', 'delete']
    .includes(method)

  // Login and registration happen before a session exists.
  const isPreAuth = [
    '/auth/login',
    '/auth/register'
  ].includes(url)

  if (isWrite && !isPreAuth) {
    const token = await ensureCsrfToken()
    config.headers['x-csrf-token'] = token
  }

  return config
})
