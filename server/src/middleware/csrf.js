import { doubleCsrf } from 'csrf-csrf';
import { randomBytes } from 'node:crypto';

// Stable for this process; configure CSRF_SECRET for multiple server instances.
const fallbackSecret = randomBytes(32).toString('hex');
export const csrfCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/'
};
export const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || fallbackSecret,
  // Bind the signed token to the authenticated session, not just the user ID.
  getSessionIdentifier: req => req.cookies.token,
  cookieName: 'csrf-token',
  cookieOptions: csrfCookieOptions,
  getCsrfTokenFromRequest: req => req.get('x-csrf-token')
});
