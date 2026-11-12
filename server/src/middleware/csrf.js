import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

// Adapted from https://github.com/Psifi-Solutions/csrf-csrf#configuration
// A random fallback supports local development; use CSRF_SECRET across replicas.
const localSecret = randomBytes(32).toString('hex');
export const csrfCookieName = process.env.NODE_ENV === 'production'
  ? '__Host-csrf-token' : 'csrf-token';
export const csrfCookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/'
};

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || localSecret,
  // Bind to the whole JWT, not the user ID: each login is a different session.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => req.method === 'POST' &&
    ['/auth/login', '/auth/register'].includes(req.path)
});
