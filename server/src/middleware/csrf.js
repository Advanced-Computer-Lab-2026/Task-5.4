import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the signed double-submit-cookie pattern (csrf-csrf).
//
// How it works:
//   1. The client calls GET /api/csrf-token. The server generates a random token,
//      HMAC-signs it with CSRF_SECRET (bound to the current session), stores the
//      signed value in an httpOnly cookie and returns the token in the JSON body.
//   2. On every state-changing request the client echoes the token back in the
//      `x-csrf-token` header. The server checks that header against the cookie.
//
// Why the attacker can't pass this check:
//   - The browser attaches our cookies to a forged cross-site request, but a plain
//     HTML <form> cannot set a custom header, and a cross-origin fetch() that sets
//     one triggers a CORS preflight that our CORS policy (client origin only) denies.
//   - The attacker can't READ the token either: the /csrf-token response is
//     cross-origin, so CORS blocks the attacker's page from reading it.
//   - The token is HMAC-signed with a server secret and bound to the session, so
//     it can't be guessed or swapped for a token minted in another session.
//
// Why CORS / SameSite alone are not enough: CORS only controls who may READ a
// response — the forged request is still sent and acted on. SameSite keys off
// the registrable domain, not the port, so localhost:1337 -> localhost:4000 is
// "same-site" and the Lax auth cookie is still sent.
const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by the tests).
  getSecret: () => process.env.CSRF_SECRET,
  // Bind each token to the current session (the auth cookie). A token issued for
  // one session (or for "logged out") is rejected once the session changes.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // HTTPS-only in production
    path: '/'
  },
  // GET / HEAD / OPTIONS are "safe" (they must not change state) and are exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-auth routes run before a session exists, so there is nothing to forge
// "in the victim's name" yet — they stay exempt.
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token — hand the client a fresh token (and set its cookie).
export function getCsrfToken(req, res) {
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}

export { invalidCsrfTokenError };
