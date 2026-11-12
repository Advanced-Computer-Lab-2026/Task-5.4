import { doubleCsrf } from 'csrf-csrf';
import rateLimit from 'express-rate-limit';

// ---------------------------------------------------------------------------
// CSRF — double-submit-cookie pattern (csrf-csrf)
// ---------------------------------------------------------------------------
// The server issues a secret, HMAC-signed token that is bound to the current
// session (the auth cookie). It is stored in a cookie AND must be echoed back
// in the `x-csrf-token` header on every state-changing request.
//
// Why this stops CSRF where CORS and SameSite do not:
//   - CORS only stops the attacker from READING responses; the forged request
//     is still sent and still acted on.
//   - SameSite keys off the registrable domain, not the port, so
//     localhost:1337 -> localhost:4000 counts as same-site and the cookie rides.
//   - A cross-site page cannot set a custom header on a plain <form> POST, and
//     cannot read our token (CORS blocks reading GET /api/csrf-token), so it
//     can never produce a matching header + cookie pair.
const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // Read lazily so the secret can come from the environment at request time.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind the token to the session: a token minted for one session is useless
  // for another (and a new login requires a new token).
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // true in production (HTTPS only)
    path: '/'
  },
  // Safe methods never change state, so they stay exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-auth routes run before any session exists, so there is nothing for an
// attacker to ride on yet — they stay exempt.
const CSRF_EXEMPT = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (CSRF_EXEMPT.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token — hands our own client a token for the current session.
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}

// ---------------------------------------------------------------------------
// DoS — rate limiting (express-rate-limit)
// ---------------------------------------------------------------------------
// One client (keyed by IP) may make at most 30 maintenance requests per
// minute. Anything beyond that is refused with 429 Too Many Requests before
// it ever reaches the database.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
