import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// The server issues a token bound (via HMAC) to the user's session. The client
// must echo it back in the `x-csrf-token` header on every state-changing
// request. A cross-site attacker cannot do this: an HTML form cannot set custom
// headers, and the same-origin policy stops their JS from reading our token.
//
// GET/HEAD/OPTIONS are exempt (they must never change state). Login and
// register are exempt too, because they run before a session exists.
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  // Read lazily so the secret can come from the environment at request time.
  getSecret: () => process.env.CSRF_SECRET,
  // Bind the token to the auth session: a token minted for one session is
  // useless with another. The JWT changes on login, so the client re-fetches.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: false, // true in production (HTTPS only)
    path: '/'
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => CSRF_EXEMPT_PATHS.has(req.path)
});

// GET /api/csrf-token — hands the token to our own client.
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}

export { doubleCsrfProtection };
