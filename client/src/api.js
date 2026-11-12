import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken = null
let csrfTokenRequest = null

const protectedWrite = (config) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  const isMutation = ['post', 'patch', 'put', 'delete'].includes(method)
  const isPreAuth = url.includes('/auth/login') || url.includes('/auth/register')
  return isMutation && !isPreAuth && !url.includes('/csrf-token')
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfTokenRequest) {
    csrfTokenRequest = api.get('/csrf-token')
      .then(({ data }) => {
        csrfToken = data.csrfToken
        return csrfToken
      })
      .finally(() => { csrfTokenRequest = null })
  }
  return csrfTokenRequest
}

api.interceptors.request.use(async (config) => {
  if (!protectedWrite(config)) return config
  const token = await getCsrfToken()
  config.headers = config.headers || {}
  config.headers['x-csrf-token'] = token
  return config
})

export function clearCsrfToken() {
  csrfToken = null
}
