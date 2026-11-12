import { doubleCsrf } from 'csrf-csrf';

// Double-submit-cookie CSRF protection.
//
// The server issues a token (GET /api/csrf-token). The token is tied to the
// user's session (the auth cookie) and an HMAC of it is also stored in a
// separate cookie. Every state-changing request must echo the token in the
// `x-csrf-token` header. A cross-site attacker's page can make the browser send
// the cookies, but it can neither read the token (same-origin policy) nor set
// a custom header on a plain form POST, so its forged request is rejected (403).
const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  // Read lazily so the secret can be set after this module is imported.
  getSecret: () => {
    const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('CSRF_SECRET (or JWT_SECRET) must be set');
    return secret;
  },
  // Bind the token to the session so a token from one user is useless for another.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // true in production (HTTPS only)
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // GET/HEAD/OPTIONS are "safe" and exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
});

// Pre-auth routes run before a session exists, so there is nothing to forge
// against (login CSRF is out of scope here). Everything else that mutates is protected.
const EXEMPT = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT.has(req.path) || EXEMPT.has(req.originalUrl.split('?')[0])) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token
export function issueCsrfToken(req, res) {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
}

export { invalidCsrfTokenError };
