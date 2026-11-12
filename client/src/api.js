import axios from 'axios'

// The auth cookie rides along automatically (withCredentials). To prove a
// state-changing request really came from OUR UI, we also send a CSRF token
// in a custom header — something a cross-site HTML form cannot do.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken = null

// Ask the server for a token (also sets the matching CSRF cookie)
export async function refreshCsrfToken() {
  const { data } = await api.get('/csrf-token')
  csrfToken = data.csrfToken
}

// Attach the token to every state-changing request
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method)) {
    if (!csrfToken) await refreshCsrfToken()
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

// If the token is stale (e.g. you just logged in/out), get a new one and retry once
api.interceptors.response.use(null, async (error) => {
  const cfg = error.config
  if (
    error.response?.status === 403 &&
    /csrf/i.test(error.response.data?.message || '') &&
    !cfg._retried
  ) {
    cfg._retried = true
    await refreshCsrfToken()
    return api(cfg)
  }
  return Promise.reject(error)
})

export default api