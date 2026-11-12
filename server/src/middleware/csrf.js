import { doubleCsrf } from 'csrf-csrf';

// CSRF protection — double-submit cookie pattern (csrf-csrf).
//
// GET /api/csrf-token hands the client a random token AND sets a matching
// httpOnly cookie. Every state-changing request must echo the token back in the
// `x-csrf-token` header. The server checks the header against the cookie and
// verifies its HMAC, which is bound to the user's session (the auth cookie).
//
// Why an attacker can't pass this check:
//   - The browser attaches cookies automatically, but it never adds custom
//     headers. A plain HTML <form> cannot send `x-csrf-token` at all.
//   - The attacker cannot read the token: CORS blocks their page from reading
//     our responses, and the cookie is httpOnly.
//   - The token is signed with a server secret and the session id, so it
//     cannot be guessed or reused from another user's session.
const {
  doubleCsrfProtection,
  generateCsrfToken
} = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by tests).
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind each token to the current session (the JWT auth cookie). After
  // login/register the session changes, so the client fetches a fresh token.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  },
  // "Safe" methods never change state, so they are exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-auth routes run before a session exists, so they are exempt.
// (Logout is NOT exempt: forcing someone to log out is still a state change.)
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT_PATHS.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token — issue a token for the current session.
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}
