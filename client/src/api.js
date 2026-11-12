import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken
let csrfTokenRequest
const safeMethods = new Set(['get', 'head', 'options'])

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  const isPreAuth = /^\/auth\/(login|register)(?:$|\?)/.test(url)

  if (safeMethods.has(method) || isPreAuth || url.includes('/csrf-token')) return config

  if (!csrfToken) {
    // Share an in-flight fetch so simultaneous writes do not race to initialize
    // the double-submit cookie.
    csrfTokenRequest ||= api.get('/csrf-token').then((response) => {
      csrfToken = response.data.csrfToken
      return csrfToken
    }).finally(() => { csrfTokenRequest = undefined })
    await csrfTokenRequest
  }

  config.headers['x-csrf-token'] = csrfToken
  return config
})

api.interceptors.response.use((response) => {
  if (/\/auth\/(login|register|logout)(?:$|\?)/.test(response.config?.url || '')) {
    csrfToken = undefined
  }
  return response
})
