import { doubleCsrf } from 'csrf-csrf';

const csrfUtilities = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'default-csrf-secret-key-at-least-32-bytes',
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

export const doubleCsrfProtection = csrfUtilities.doubleCsrfProtection;
export const issueCsrfToken = csrfUtilities.generateCsrfToken || csrfUtilities.generateToken;

// Pre-auth routes run before a session exists and must remain exempt.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/logout']);

export function csrfProtection(req, res, next) {
  const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
  if (EXEMPT_PATHS.has(path) || EXEMPT_PATHS.has(req.originalUrl)) {
    return next();
  }
  return doubleCsrfProtection(req, res, next);
}
