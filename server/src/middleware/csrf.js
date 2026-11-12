import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';
import { requireAuth } from './auth.js';

// A generated secret supports the single-process lab. Set CSRF_SECRET to share
// a stable secret across restarts or multiple API processes.
const processSecret = randomBytes(32).toString('hex');
const secure = process.env.NODE_ENV === 'production';
const cookieName = secure ? '__Host-csrf-token' : 'csrf-token';
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure, path: '/' };
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || processSecret,
  // requireAuth verifies this JWT before either issuing or validating a token.
  getSessionIdentifier: (req) => req.authToken,
  cookieName,
  cookieOptions,
  getCsrfTokenFromRequest: (req) => req.get('x-csrf-token')
});

export function issueCsrfToken(req, res) {
  res.set('Cache-Control', 'no-store');
  // Reuse a valid token; replace one belonging to an earlier login session.
  res.json({ csrfToken: generateCsrfToken(req, res) });
}

export function clearCsrfCookie(res) {
  res.clearCookie(cookieName, cookieOptions);
}

export function protectStateChanges(req, res, next) {
  if (safeMethods.has(req.method)) return next();

  // This middleware is mounted at /api. Match only the two pre-auth POSTs,
  // including Express's optional trailing slash and case-insensitive routing.
  if (req.method === 'POST' && /^\/auth\/(login|register)\/?$/i.test(req.path)) {
    return next();
  }

  return requireAuth(req, res, (err) => {
    if (err) return next(err);
    return doubleCsrfProtection(req, res, next);
  });
}
