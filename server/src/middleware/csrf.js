import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the signed double-submit-cookie pattern (csrf-csrf).
//
// Why this is needed even though we already have CORS and SameSite cookies:
//   - CORS only stops another origin from *reading* our responses. A plain HTML
//     <form> POST (urlencoded body, no custom headers) is a "simple request": the
//     browser sends it without a preflight and the server still performs the write.
//   - SameSite=Lax keys off the *site* (registrable domain), not the port, so a page
//     on localhost:1337 is "same-site" with the API on localhost:4000 and the auth
//     cookie still rides along. Subdomains of the same site have the same problem.
//
// The fix: every state-changing request must carry a secret token in a custom
// `x-csrf-token` header. The token is an HMAC (keyed by CSRF_SECRET) bound to the
// user's session, and is also stored in an httpOnly cookie. The server checks that
// the header and the cookie match and that the HMAC is valid for this session.
// An attacker's page cannot read the token (CORS blocks reading /api/csrf-token,
// the cookie is httpOnly) and a plain form cannot set custom headers, so a forged
// request is rejected with 403.

const isProd = process.env.NODE_ENV === 'production';

// Routes that run before a session exists (there is nothing to forge yet), so
// they are exempt. Everything else that is not GET/HEAD/OPTIONS is protected.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export const CSRF_COOKIE_NAME = isProd ? '__Host-dorm.x-csrf-token' : 'dorm.x-csrf-token';

const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  // Read lazily so the secret can be supplied at runtime (e.g. via .env or tests).
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind each token to the current session (the auth cookie), so a token issued
  // to one session is useless in another. A new login means a new token.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd, // `__Host-` cookies require HTTPS, so only in production
    path: '/'
  },
  // "Safe" methods never change state, so they do not need a token.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => EXEMPT_PATHS.has(req.path)
});

// GET /api/csrf-token — hands the client a token for its current session.
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
}

export { doubleCsrfProtection, invalidCsrfTokenError };
