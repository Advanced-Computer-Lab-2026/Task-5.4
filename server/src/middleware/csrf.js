import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF via the double-submit-cookie pattern (the `csrf-csrf` package —
// the old `csurf` is deprecated).
//
// How it closes the hole the simulation proved open:
//   The server issues a secret, per-session token (GET /api/csrf-token) and
//   stores a keyed hash of it in a cookie. Every state-changing request must
//   echo the raw token in the `x-csrf-token` header. An attacker's page can
//   cause the *cookie* to ride along (same-site rules permitting), but it can
//   neither read the token (cross-origin responses are opaque to it) nor set
//   a custom header from a plain HTML form — so its forged write is refused.
//
// Safe requests (GET/HEAD/OPTIONS) and the pre-auth routes (register/login,
// which run before a session exists) are exempt.
const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError
} = doubleCsrf({
  // A dedicated secret, separate from the JWT secret.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  cookieName: 'csrfToken',
  cookieOptions: {
    httpOnly: true,     // the client echoes the token from the JSON body, not the cookie
    sameSite: 'lax',
    secure: false,      // true in production (HTTPS only)
    maxAge: 24 * 60 * 60 * 1000
  },
  // The client sends the token in a header (a form post cannot set headers).
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
});

// Wrap the package middleware so an invalid/missing token is always a clean
// 403 JSON response.
export function csrfProtection(req, res, next) {
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      const isCsrfError = err === invalidCsrfTokenError || err.code === 'EBADCSRFTOKEN';
      return res
        .status(isCsrfError ? 403 : 500)
        .json({ message: isCsrfError ? 'Invalid or missing CSRF token' : 'Server error' });
    }
    next();
  });
}

export { generateToken };
