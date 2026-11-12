import axios from 'axios'

// The browser sends the httpOnly session cookie; writes also need proof of intent.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfTokenRequest

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const safe = ['get', 'head', 'options'].includes(method)
  const preAuth = method === 'post' && ['/auth/login', '/auth/register'].includes(config.url)
  if (safe || preAuth) return config

  // Reuse only in-flight fetches. Fetch again for later writes so a new login
  // never reuses the previous session's token (including logins in another tab).
  csrfTokenRequest ||= api.get('/csrf-token')
  try {
    const { data } = await csrfTokenRequest
    config.headers['x-csrf-token'] = data.csrfToken
    return config
  } finally {
    csrfTokenRequest = undefined
  }
})
