import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// GET /api/csrf-token hands the client a token and sets a matching httpOnly
// cookie. Every state-changing request must echo that token back in the
// `x-csrf-token` header. The server checks that the header matches the cookie
// and that it was signed with our secret for THIS session.
//
// An attacker's page can make the browser send our cookies, but it cannot:
//   - read the token (CORS blocks reading our responses, the cookie is httpOnly),
//   - set a custom header on a plain <form> POST, or on a cross-origin fetch
//     without a CORS preflight that our server refuses.
// So a forged request arrives without a valid token and is rejected with 403.
const isProd = process.env.NODE_ENV === 'production';

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by the tests).
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Ties the token to the logged-in session: a token issued for one session
  // is useless with another session's cookie. Before login there is no auth
  // cookie yet, so the token is bound to the "anonymous" session.
  getSessionIdentifier: (req) => req.cookies?.token || 'anonymous',
  // The "__Host-" prefix (the library default) needs HTTPS, so only use it in production.
  cookieName: isProd ? '__Host-psifi.x-csrf-token' : 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: isProd ? 'strict' : 'lax',
    secure: isProd,
    path: '/'
  },
  // Safe methods never change state, so they are exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-auth routes run before a session exists, so they are exempt.
// (They don't act on an existing session; the worst a forged login can do is
// log the victim into the attacker's account, which is out of scope here.)
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT_PATHS.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token
export function csrfTokenHandler(req, res) {
  // overwrite: true issues a fresh token bound to the current session cookie
  // (e.g. right after login, when the session identifier has changed).
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}
