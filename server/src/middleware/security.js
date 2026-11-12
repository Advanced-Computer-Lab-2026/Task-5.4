import { doubleCsrf } from 'csrf-csrf';
import { rateLimit } from 'express-rate-limit';

// ---------------------------------------------------------------------------
// CSRF — double-submit-cookie pattern (csrf-csrf)
// ---------------------------------------------------------------------------
// The server issues a token that is HMAC-signed with a server secret and bound
// to the user's session (their auth cookie). The token is stored in a cookie
// AND must be echoed back by our own client in the `x-csrf-token` header.
//
// An attacker's page can make the browser *send* our cookies, but it cannot
// *read* the token (CORS blocks reading our responses) and cannot set custom
// headers on a plain HTML form POST — so a forged request has no valid header
// and is rejected with 403.

// Routes that run before a session exists: there is nothing to forge yet.
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/register', '/api/auth/login']);

const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // Read lazily so the secret can be provided after this module is imported
  // (dotenv in index.js, or the test setup).
  getSecret: () => process.env.CSRF_SECRET,
  // Bind each token to the current session: a token minted for one session is
  // useless for another.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',
  // `__Host-` cookies require HTTPS, so use a plain name for local http dev.
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // "Safe" methods never change state and are not checked.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => CSRF_EXEMPT_PATHS.has(req.path)
});

export { doubleCsrfProtection as csrfProtection };

// GET /api/csrf-token — hands our own client a fresh token for this session.
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}

// ---------------------------------------------------------------------------
// DoS — rate limiting (express-rate-limit)
// ---------------------------------------------------------------------------
// One client (keyed by IP) may make at most 20 maintenance calls per minute.
// Beyond that the server answers 429 Too Many Requests without touching the DB.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
