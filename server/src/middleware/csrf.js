import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// GET /api/csrf-token hands the client a token and sets a matching httpOnly
// cookie that holds an HMAC of it, signed with CSRF_SECRET and bound to the
// caller's session (their auth cookie). Every state-changing request must then
// echo the token back in the `x-csrf-token` header.
//
// Why this stops the attacker page:
//   - It cannot read the token: CORS blocks it from reading our responses, and
//     the cookie is httpOnly on our origin.
//   - It cannot guess or forge one: the token is random and HMAC-signed with a
//     server secret, and tied to the victim's session.
//   - A plain HTML <form> cannot set a custom header at all, and a fetch() that
//     sets one triggers a CORS preflight that our CORS policy rejects.
// The browser still attaches the cookies automatically — but without the
// matching header value the request is refused with 403.
//
// CORS is not enough on its own: it only stops the attacker from *reading*
// responses; a simple form POST is still *sent* and acted on. SameSite=Lax is
// not enough either: localhost:1337 and localhost:4000 are the same "site"
// (ports are ignored), so the auth cookie still rides along.

// Pre-auth routes: no session exists yet, so there is nothing to forge on the
// user's behalf. They must stay reachable without a token.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind the token to the session: a token issued for one login is useless for
  // another. Before login this is '' (only the exempt routes are used then).
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    path: '/'
  },
  // GET/HEAD/OPTIONS are "safe" (they must not change state) and are ignored.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => EXEMPT_PATHS.has(req.path)
});

// GET /api/csrf-token
export function csrfTokenHandler(req, res) {
  // overwrite: true issues a fresh token, e.g. after the user logs in.
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}

export const csrfProtection = doubleCsrfProtection;
export { invalidCsrfTokenError };
