import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// GET /api/csrf-token issues a token that is an HMAC over the caller's session
// (the JWT auth cookie) + randomness, signed with CSRF_SECRET. The token is
// stored in an httpOnly cookie AND returned in the response body; the client
// echoes it back in the `x-csrf-token` header on every state-changing request.
// The server accepts the write only if the header matches the cookie and the
// HMAC verifies for the current session.
//
// An attacker's page cannot produce that header: it cannot read our response
// (CORS), cannot read the httpOnly cookie, and cannot compute the HMAC without
// the server-side secret. A plain cross-site <form> cannot set custom headers
// at all. So forged requests fail with 403 before any controller runs.

function getSecret() {
  const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('CSRF_SECRET (or JWT_SECRET) must be set');
  return secret;
}

const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret,
  // Bind every token to the current login session: a token minted for one
  // session (or for no session) is useless for another.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // Safe methods never change state, so they are exempt.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Pre-authentication routes: no session exists yet, so there is nothing to forge.
const EXEMPT_PATHS = ['/api/auth/login', '/api/auth/register'];

export function csrfProtection(req, res, next) {
  if (EXEMPT_PATHS.includes(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res);
  res.set('Cache-Control', 'no-store'); // never let a proxy/browser cache a token
  res.json({ csrfToken });
}
