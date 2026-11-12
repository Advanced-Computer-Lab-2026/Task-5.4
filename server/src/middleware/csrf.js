import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// GET /api/csrf-token hands the client a token and also sets it, HMAC-signed, in an
// httpOnly cookie. Every state-changing request must echo the token in the
// `x-csrf-token` header, and the server checks it against the cookie.
//
// Why an attacker's page can't pass this check:
//   - A cross-site <form> can't set custom headers, and a cross-site fetch() that
//     tries to triggers a CORS preflight, which our CORS policy rejects.
//   - The attacker can't read the token: the cookie is httpOnly, and CORS blocks
//     reading the /csrf-token response from another origin.
//   - The token is HMAC-signed with a server secret and bound to the session (the
//     auth cookie), so it can't be forged or carried over from another session.
//
// CORS and SameSite aren't enough on their own. CORS only stops the attacker from
// *reading* the response; the browser still *sends* the forged request. SameSite
// is keyed on the registrable domain, not the port, so localhost:1337 and
// localhost:4000 count as the same site and the auth cookie still goes along.

const PRE_AUTH_ROUTES = new Set(['/api/auth/login', '/api/auth/register']);

export const CSRF_COOKIE_NAME = 'x-csrf-token';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by tests at runtime).
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind each token to the current session. A token issued to one session (or
  // to an anonymous visitor) fails validation for any other session.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // Safe methods aren't checked, since they must never change state.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // Login and register run before a session exists, so there's nothing to protect yet.
  skipCsrfProtection: (req) => PRE_AUTH_ROUTES.has(req.path),
  errorConfig: { statusCode: 403, message: 'Invalid or missing CSRF token', code: 'EBADCSRFTOKEN' }
});

export const csrfProtection = doubleCsrfProtection;

// GET /api/csrf-token
// Always issue a fresh token, because the session may have changed since the
// last one (for example, after login).
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}
