import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken
let csrfTokenRequest

api.interceptors.request.use(async config => {
  const method = config.method?.toLowerCase()
  if (!method || ['get', 'head', 'options'].includes(method)) return config

  const url = config.url || ''
  if (method === 'post' && /^\/auth\/(login|register)\/?$/.test(url)) {
    csrfToken = undefined
    return config
  }

  if (!csrfToken) {
    csrfTokenRequest ||= api.get('/csrf-token').then(res => {
      csrfToken = res.data.csrfToken
      return csrfToken
    }).finally(() => {
      csrfTokenRequest = undefined
    })
    await csrfTokenRequest
  }

  config.headers['x-csrf-token'] = csrfToken
  return config
})
