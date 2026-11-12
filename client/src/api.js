import axios from 'axios'

// `withCredentials: true` sends the httpOnly auth cookie. Because that cookie is
// sent automatically, every state-changing request also echoes a per-session
// CSRF token in a header that a cross-site page cannot read or set.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

const SAFE = ['get', 'head', 'options']

api.interceptors.request.use(async (config) => {
  if (SAFE.includes((config.method || 'get').toLowerCase())) return config
  if (/^\/auth\/(login|register)$/.test(config.url || '')) return config
  const { data } = await api.get('/csrf-token')
  config.headers['x-csrf-token'] = data.csrfToken
  return config
})
