import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

// A process-local fallback keeps local development usable; configure CSRF_SECRET
// consistently across instances in a deployment.
const fallbackSecret = randomBytes(32).toString('hex');
export const csrfCookieName = process.env.NODE_ENV === 'production'
  ? '__Host-csrf-token' : 'csrf-token';
export const csrfCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/'
};

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || fallbackSecret,
  // The signed JWT is unique to each login, including repeat logins by one user.
  getSessionIdentifier: req => req.cookies.token,
  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,
  getCsrfTokenFromRequest: req => req.headers['x-csrf-token']
});
