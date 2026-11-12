import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken
let csrfTokenRequest

function isPreAuthRequest(url = '') {
  return url === '/auth/login' || url === '/auth/register'
}

function clearCsrfToken() {
  csrfToken = undefined
  csrfTokenRequest = undefined
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfTokenRequest) {
    csrfTokenRequest = api.get('/csrf-token')
      .then(res => {
        csrfToken = res.data.csrfToken
        return csrfToken
      })
      .catch(err => {
        csrfTokenRequest = undefined
        throw err
      })
  }
  return csrfTokenRequest
}

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const safeMethod = ['get', 'head', 'options'].includes(method)

  if (!safeMethod && !isPreAuthRequest(config.url)) {
    const token = await getCsrfToken()
    if (typeof config.headers?.set === 'function') {
      config.headers.set('x-csrf-token', token)
    } else {
      config.headers = config.headers || {}
      config.headers['x-csrf-token'] = token
    }
  }

  return config
})

api.interceptors.response.use(response => {
  if (isPreAuthRequest(response.config.url)) clearCsrfToken()
  return response
})
