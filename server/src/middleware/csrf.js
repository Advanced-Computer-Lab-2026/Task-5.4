import { doubleCsrf } from 'csrf-csrf';
import { requireAuth } from './auth.js';

export const csrfCookieName = process.env.NODE_ENV === 'production'
  ? '__Host-csrf-token' : 'csrf-token';
export const csrfCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
};

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => {
    if (!process.env.CSRF_SECRET) throw new Error('CSRF_SECRET is not set');
    return process.env.CSRF_SECRET;
  },
  // requireAuth verifies this JWT before generation or validation. Each login
  // has a fresh jti, so even two logins by the same user have different tokens.
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,
  getCsrfTokenFromRequest: (req) => req.get('x-csrf-token')
});

export function protectWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Only these two POST routes run before a session exists. Logout is protected.
  if (req.method === 'POST' && /^\/auth\/(login|register)\/?$/i.test(req.path)) {
    return next();
  }
  return requireAuth(req, res, () => doubleCsrfProtection(req, res, next));
}
