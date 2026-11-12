import axios from 'axios'

// The browser sends the cookies; our app explicitly sends the CSRF header.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let pendingToken

function fetchCsrfToken() {
  // Share concurrent requests, but do not cache across logins or browser tabs.
  if (!pendingToken) {
    pendingToken = api.get('/csrf-token')
      .then(({ data }) => {
        if (!data.csrfToken) throw new Error('The server did not provide a CSRF token')
        return data.csrfToken
      })
      .finally(() => { pendingToken = undefined })
  }
  return pendingToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (['get', 'head', 'options'].includes(method)) return config
  if (method === 'post' && /^\/auth\/(login|register)\/?(?:\?.*)?$/i.test(config.url || '')) {
    return config
  }
  config.headers = config.headers || {}
  config.headers['x-csrf-token'] = await fetchCsrfToken()
  return config
})
