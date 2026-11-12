import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken
let csrfTokenRequest

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  if (!['post', 'put', 'patch', 'delete'].includes(method) ||
      url.includes('/csrf-token') || url.includes('/auth/login') || url.includes('/auth/register')) {
    return config
  }

  if (!csrfToken) {
    csrfTokenRequest ||= api.get('/csrf-token').then(res => {
      csrfToken = res.data.csrfToken
      return csrfToken
    }).finally(() => { csrfTokenRequest = undefined })
    await csrfTokenRequest
  }
  config.headers = config.headers || {}
  config.headers['x-csrf-token'] = csrfToken
  return config
})

export function clearCsrfToken() {
  csrfToken = undefined
  csrfTokenRequest = undefined
}
