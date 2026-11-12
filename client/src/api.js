import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const safeMethods = new Set(['get', 'head', 'options'])
const preAuthPaths = new Set(['/auth/login', '/auth/register'])
let pendingToken

function apiPath(config) {
  const base = new URL(api.defaults.baseURL + '/')
  const url = new URL(api.getUri(config), base)
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new Error('Use this client only for the configured API')
  }
  return url.pathname.slice(base.pathname.length - 1).replace(/\/$/, '')
}

async function fetchCsrfToken() {
  // Share only in-flight fetches. Never retain a token across session changes,
  // logout, rotation, or another tab replacing the authentication cookie.
  if (!pendingToken) {
    pendingToken = api.get('/csrf-token').then(({ data }) => {
      if (!data.csrfToken) throw new Error('Missing CSRF token response')
      return data.csrfToken
    }).finally(() => { pendingToken = undefined })
  }
  return pendingToken
}

api.interceptors.request.use(async (config) => {
  const path = apiPath(config)
  if (!safeMethods.has((config.method || 'get').toLowerCase()) && !preAuthPaths.has(path)) {
    config.headers['x-csrf-token'] = await fetchCsrfToken()
  }
  // The token endpoint is GET, so it never recursively requests another token.
  return config
})

api.interceptors.response.use((response) => response, async (error) => {
  const config = error.config
  if (config && error.response?.status === 403 &&
      error.response.data?.code === 'EBADCSRFTOKEN' && !config.csrfRetried) {
    // CSRF middleware rejected before any write. Fetch afresh and retry once
    // if a concurrent session or CSRF-cookie rotation raced the first request.
    config.csrfRetried = true
    return api.request(config)
  }
  return Promise.reject(error)
})
