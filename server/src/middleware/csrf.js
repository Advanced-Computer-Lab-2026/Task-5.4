import { doubleCsrf } from 'csrf-csrf';

// Double-submit-cookie CSRF protection. The token is an HMAC bound to the
// session (the auth cookie), so a token minted for one session is useless for another.
const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET || 'dev-csrf-secret',
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'csrf-token',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // GET/HEAD/OPTIONS are exempt (default)
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
});

// Pre-auth routes run before a session exists, so there is nothing to forge.
const EXEMPT = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token
export function csrfTokenHandler(req, res) {
  res.json({ csrfToken: generateCsrfToken(req, res, { overwrite: true }) });
}
