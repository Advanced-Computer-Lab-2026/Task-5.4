import axios from 'axios'

// The session cookie is automatic; the CSRF header proves the UI obtained a
// token from the API for this session.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfRequest
function currentCsrfToken() {
  // Concurrent first writes must share one fetch, otherwise two new cookies
  // could race and no longer match the corresponding request headers.
  if (!csrfRequest) {
    csrfRequest = api.get('/csrf-token')
      .then(res => res.data.csrfToken)
      .finally(() => { csrfRequest = undefined })
  }
  return csrfRequest
}

api.interceptors.request.use(async config => {
  const method = (config.method || 'get').toLowerCase()
  const path = (config.url || '').split('?')[0].replace(/\/+$/, '').toLowerCase()
  const safe = ['get', 'head', 'options'].includes(method)
  const preAuth = method === 'post' && ['/auth/login', '/auth/register'].includes(path)
  if (!safe && !preAuth) {
    // Fetch for each write so login changes in another tab cannot leave a
    // cached token associated with the previous session. GET cannot recurse.
    config.headers['x-csrf-token'] = await currentCsrfToken()
  }
  return config
})
