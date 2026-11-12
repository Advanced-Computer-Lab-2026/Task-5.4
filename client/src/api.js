import axios from 'axios'

function getCsrfToken() {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrfToken='))
    ?.split('=')[1]
}

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

api.interceptors.request.use(config => {
  const method = config.method?.toLowerCase()
  if (method && ['post', 'patch', 'put', 'delete'].includes(method)) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      config.headers = {
        ...config.headers,
        'X-CSRF-Token': csrfToken
      }
    }
  }

  return config
})
