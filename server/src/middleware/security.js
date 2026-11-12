import { doubleCsrf } from 'csrf-csrf';
import { rateLimit } from 'express-rate-limit';

// ---------------------------------------------------------------------------
// CSRF protection — double-submit-cookie pattern (csrf-csrf)
// ---------------------------------------------------------------------------
// The server hands the client a secret token (GET /api/csrf-token). The same
// value is also bound to an httpOnly cookie as an HMAC, tied to the user's
// session. Every state-changing request must echo the token in the
// `x-csrf-token` header.
//
// An attacker's page cannot pass this check:
//   - It cannot READ the token: the response body of /api/csrf-token is
//     blocked by CORS (only http://localhost:5175 may read it), and the cookie
//     is httpOnly.
//   - It cannot GUESS the token: it is random and HMAC-signed with CSRF_SECRET.
//   - A plain HTML <form> cannot set custom headers at all, and a cross-origin
//     fetch() with a custom header triggers a CORS preflight that we refuse.
//
// Why CORS / SameSite alone are not enough:
//   - CORS only controls who may READ a response. The browser still SENDS a
//     "simple" request (e.g. a form POST) and the server still acts on it.
//   - SameSite keys off the registrable domain, not the port, so
//     localhost:1337 -> localhost:4000 is "same-site" and the Lax cookie is
//     sent. Sibling subdomains and older browsers break it too.

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by tests at runtime).
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind the token to the current session (the auth cookie). After login /
  // logout the session changes, so the client must fetch a fresh token.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    path: '/'
  },
  // GET / HEAD / OPTIONS are "safe" (must not change state) and stay exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-auth routes run before a session exists, so there is nothing for an
// attacker to ride on yet — they stay exempt. Everything else is protected.
const CSRF_EXEMPT = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (req.method === 'POST' && CSRF_EXEMPT.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token — issues (and sets the cookie for) a token for this session.
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}

// ---------------------------------------------------------------------------
// DoS protection — rate limiting (express-rate-limit)
// ---------------------------------------------------------------------------
// One client (keyed by IP) may make at most MAINTENANCE_RATE_LIMIT requests to
// the maintenance feature per minute; beyond that it gets 429 Too Many Requests
// and the controller (and its database query) never runs.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.MAINTENANCE_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7', // RateLimit-* headers so clients know when to retry
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
