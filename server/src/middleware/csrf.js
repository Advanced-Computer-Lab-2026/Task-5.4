import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';
import { requireAuth } from './auth.js';

// Stable for this process. Set CSRF_SECRET to share a key across API workers.
const processSecret = randomBytes(32).toString('hex');
const production = process.env.NODE_ENV === 'production';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfCookieName = production ? '__Host-csrf-token' : 'csrf-token';
export const csrfCookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: 'lax',
  path: '/'
};

export const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || processSecret,
  // Bind the HMAC to this login session, never just the user's ID.
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,
  getCsrfTokenFromRequest: (req) => req.get('x-csrf-token')
});

export function protectWrites(req, res, next) {
  if (safeMethods.has(req.method)) return next();
  return requireAuth(req, res, () => doubleCsrfProtection(req, res, next));
}
