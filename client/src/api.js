import axios from 'axios'

// Send the session and CSRF cookies with API requests.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// Share an in-flight fetch so simultaneous writes do not race to set cookies.
// Fetch again for subsequent writes so a changed login session gets a fresh token.
let pendingCsrfToken
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const path = new URL(api.getUri(config)).pathname
  if (['post', 'patch', 'delete'].includes(method) &&
      /^\/api\/maintenance(?:\/|$)/.test(path)) {
    if (!pendingCsrfToken) {
      pendingCsrfToken = api.get('/csrf-token')
        .then(({ data }) => data.csrfToken)
        .finally(() => { pendingCsrfToken = undefined })
    }
    config.headers['x-csrf-token'] = await pendingCsrfToken
  }
  return config
})
