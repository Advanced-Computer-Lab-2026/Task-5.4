import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API — including requests triggered by a different site.
// That convenience is exactly what leaves this app open to CSRF: there is no
// second proof that a state-changing request actually came from our own UI.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
})

// CSRF token management
let csrfToken = null

export async function fetchCsrfToken() {
  try {
    const res = await api.get('/csrf-token')
    csrfToken = res.data.csrfToken
    return csrfToken
  } catch (err) {
    console.warn('Could not fetch CSRF token:', err.message)
    return null
  }
}

export function getCsrfToken() {
  return csrfToken
}

// Request interceptor to add CSRF token to state-changing requests
api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase()
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    // Auto-fetch CSRF token if we don't have one
    if (!csrfToken) {
      await fetchCsrfToken()
    }
    if (csrfToken) {
      config.headers['x-csrf-token'] = csrfToken
    }
  }
  return config
})

// Response interceptor to refresh CSRF token if we get a 403 with CSRF error
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.message?.includes('CSRF')) {
      // Token might have expired, try to fetch a new one
      await fetchCsrfToken()
      // Retry the original request with new token
      if (error.config && csrfToken) {
        error.config.headers['x-csrf-token'] = csrfToken
        return api.request(error.config)
      }
    }
    return Promise.reject(error)
  }
)