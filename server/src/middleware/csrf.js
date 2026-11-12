import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// How it works:
//   1. The client calls GET /api/csrf-token. The server generates a token that is
//      an HMAC of a random value + the caller's session, signed with CSRF_SECRET.
//      It puts a hashed copy in an httpOnly cookie and returns the token in the body.
//   2. On every state-changing request the client echoes the token in the
//      `x-csrf-token` header. The server checks header + cookie + session match.
//
// Why the attacker can't pass this check:
//   - A cross-site <form> or fetch can make the browser SEND cookies, but it cannot
//     READ our responses (Same-Origin Policy), so it never learns the token.
//   - A plain HTML form cannot set a custom header at all, and a cross-origin fetch
//     with a custom header triggers a CORS preflight that our CORS policy refuses.
//   - The token is bound to the session (the auth cookie), so a token obtained by
//     the attacker for their own session is useless against the victim's.
const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // Read lazily so tests / .env can set it after the module is imported.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Tie each token to the current session. Before login there is no auth cookie,
  // so an anonymous token is tied to the empty session.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  // Not using the "__Host-" prefix: it requires `secure`, and the dev app runs on http.
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // GET / HEAD / OPTIONS are "safe" (read-only) and stay exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-auth routes run before a session exists, so there is nothing to forge yet.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT_PATHS.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token — hands the token to our own client (same-origin JS only can read it).
export function csrfTokenHandler(req, res) {
  // overwrite: true issues a fresh token, e.g. after login changed the session.
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}
