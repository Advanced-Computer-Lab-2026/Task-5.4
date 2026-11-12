import { doubleCsrf } from 'csrf-csrf';

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.JWT_SECRET,
  getSessionIdentifier: (req) => req.cookies.token || '', // tie token to the session
  cookieName: 'csrf-token',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});