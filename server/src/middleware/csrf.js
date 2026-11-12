import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';
const fallbackSecret = randomBytes(32).toString('hex');
export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || fallbackSecret,
  getSessionIdentifier: req => req.cookies.token || '',
  cookieName: process.env.NODE_ENV === 'production' ? '__Host-csrf' : 'csrf',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
  getCsrfTokenFromRequest: req => req.headers['x-csrf-token']
});
