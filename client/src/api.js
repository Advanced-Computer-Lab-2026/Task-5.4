import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

let csrfToken
let pendingToken
let generation = 0

export function clearCsrfToken() {
  generation += 1
  csrfToken = undefined
  pendingToken = undefined
}

export function fetchCsrfToken() {
  if (csrfToken) return Promise.resolve(csrfToken)
  if (!pendingToken) {
    const currentGeneration = generation
    pendingToken = api.get('/csrf-token').then(({ data }) => {
      if (currentGeneration !== generation) throw new Error('Session changed while fetching CSRF token')
      csrfToken = data.csrfToken
      return csrfToken
    }).finally(() => {
      if (currentGeneration === generation) pendingToken = undefined
    })
  }
  return pendingToken
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  const preAuth = ['/auth/login', '/auth/register'].includes(config.url)
  if (!['get', 'head', 'options'].includes(method) && !preAuth) {
    config.headers['x-csrf-token'] = await fetchCsrfToken()
  }
  return config
})
