import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// How it defeats the attack:
//   - GET /api/csrf-token issues a token that is HMAC-bound to the caller's
//     session (their auth cookie) and to a server secret, and also sets a
//     matching httpOnly CSRF cookie.
//   - Every state-changing request must echo that token back in the
//     `x-csrf-token` header. The server checks header + cookie + session.
//   - An attacker's page can make the browser *send* cookies, but it cannot
//     *read* our token (CORS/same-origin policy blocks reading the response)
//     and a plain HTML <form> cannot set custom headers. So the forged request
//     arrives without a valid token and is rejected with 403.
const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by tests) at runtime.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind the token to the current session: a token minted for one login is
  // useless with another user's (or a later) session cookie.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // true in production (HTTPS only); then prefer the __Host- prefix
    path: '/'
  },
  // Safe methods never change state, so they are exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-auth routes run before any session exists, so there is nothing for an
// attacker to ride on yet; they stay exempt (the client also has no session
// to bind a token to at that point).
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT_PATHS.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token
export function csrfTokenHandler(req, res) {
  // overwrite: true so a token minted before login is replaced by one bound to
  // the new session.
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}
