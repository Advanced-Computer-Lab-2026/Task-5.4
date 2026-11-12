import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the (signed) double-submit-cookie pattern.
//
// Why the auth cookie alone is not enough:
//   - The browser attaches the auth cookie to ANY request bound for the API,
//     including one forged by another site's auto-submitting <form>.
//   - CORS does not help: it only stops the attacker from READING the reply.
//     The forged request is still sent and the server still acts on it.
//   - SameSite=Lax does not help here either: localhost:1337 and localhost:4000
//     are the same *site* (the port is ignored), so the cookie is still sent.
//
// How this fixes it:
//   1. GET /api/csrf-token returns a random token (HMAC-signed with CSRF_SECRET
//      and bound to the current session) in the JSON body, and sets a matching
//      httpOnly cookie.
//   2. Every state-changing request (POST/PUT/PATCH/DELETE) must echo that token
//      back in the `x-csrf-token` header. The server checks the header against
//      the cookie and the session.
//   3. The attacker can make the browser SEND the cookie, but cannot READ the
//      token (CORS blocks reading /api/csrf-token from another origin), cannot
//      guess it, and a plain HTML form cannot set custom headers. So the forged
//      request fails with 403.
const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by tests at runtime).
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind each token to the user's session (their auth cookie). A token issued
  // for one session is useless for another — e.g. it must be re-fetched after
  // login/register, and a token planted by an attacker will not validate.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  // "Safe" methods must not change state, so they don't need a token.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

// Pre-auth routes run before a session exists, so there is no session to bind
// a token to (and nothing to forge "in the user's name" yet). They stay exempt.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT_PATHS.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token — hand the token to our own client (CORS keeps other
// origins from reading this response).
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}
