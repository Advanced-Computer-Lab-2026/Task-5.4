import axios from 'axios'

// Keep authentication cookies in the browser and echo a separate CSRF token.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const safeMethods = new Set(['get', 'head', 'options'])
const preAuthPaths = new Set(['/auth/login', '/auth/register'])
let pendingCsrfToken

function getCsrfToken() {
  // Share concurrent fetches so first writes cannot race to set different cookies.
  // Fetch again for later writes so a changed login session never uses a stale token.
  if (!pendingCsrfToken) {
    pendingCsrfToken = api.get('/csrf-token')
      .then(({ data }) => data.csrfToken)
      .finally(() => { pendingCsrfToken = undefined })
  }
  return pendingCsrfToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const requestPath = new URL(api.getUri(config)).pathname.replace(/^\/api/, '').replace(/\/$/, '')
  if (!safeMethods.has(method) && !(method === 'post' && preAuthPaths.has(requestPath))) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})
