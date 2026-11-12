import axios from 'axios'

// `withCredentials: true` makes the browser send the httpOnly auth cookie on
// every request to the API. To stop cross-site forgery, axios also copies the
// server-issued `csrfToken` cookie into the X-CSRF-Token header on each
// request; the server rejects unsafe requests where the two don't match.
export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true,
  xsrfCookieName: 'csrfToken',
  xsrfHeaderName: 'X-CSRF-Token'
})
