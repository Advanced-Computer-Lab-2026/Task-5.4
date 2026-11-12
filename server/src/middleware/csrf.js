import { doubleCsrf } from 'csrf-csrf';

// Double-submit-cookie CSRF protection (csrf-csrf).
// The server hands the client a token: one copy lives in a cookie, the other is
// returned in the JSON body. The client echoes the body copy in the
// `x-csrf-token` header on every write. A cross-site attacker can make the
// browser send the cookie, but cannot read the token (same-origin policy) and
// cannot set a custom header on a plain form POST, so the forged request fails.
const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET || 'dev-csrf-secret',
  // Bind the token to the user's session (the auth cookie) so a token issued
  // to one session cannot be replayed on another.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'csrf-token',
  cookieOptions: { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true, path: '/' },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-auth routes run before a session exists, so there is nothing to forge.
const EXEMPT = new Set(['/auth/login', '/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

export function csrfTokenHandler(req, res) {
  res.json({ csrfToken: generateCsrfToken(req, res) });
}

export { invalidCsrfTokenError };
