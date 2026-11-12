import { doubleCsrf } from 'csrf-csrf';

// Double-submit-cookie CSRF protection.
//
// The token is HMAC-bound to the caller's session (the auth JWT cookie), so a
// token issued for one user is useless for another. The server sets the token
// in a cookie AND hands the same value to our own JS, which echoes it back in
// the `x-csrf-token` header. A cross-site page can make the browser *send* the
// cookie, but it cannot read it (or the response body: CORS) and so cannot set
// the matching header.
const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  // Read lazily so values loaded by dotenv / set by tests are picked up.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  getSessionIdentifier: (req) => req.cookies?.token || '',
  // No `__Host-` prefix: it requires `Secure`, which is off for http://localhost.
  cookieName: 'csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    secure: false, // true in production (HTTPS only)
    httpOnly: true,
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
  // Default ignoredMethods: GET, HEAD, OPTIONS — safe requests stay exempt.
});

// GET /api/csrf-token — issues a token tied to the current session.
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
}

// Apply to every state-changing route. Missing/invalid token -> 403.
export { doubleCsrfProtection as csrfProtection, invalidCsrfTokenError };
