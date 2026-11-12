import { doubleCsrf } from 'csrf-csrf';

// Double-submit-cookie CSRF protection.
// The server sets a signed token in an httpOnly cookie AND hands the same token
// to our client via GET /api/csrf-token. On every state-changing request the
// client must echo it in the `x-csrf-token` header. An attacker's page can make
// the browser send cookies, but it can neither read the token nor set a custom
// header on a cross-site form, so forged requests fail with 403.
export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by the tests).
  getSecret: () => process.env.CSRF_SECRET,
  // Bind the token to the logged-in session (the JWT cookie), so a token
  // issued for one session is useless in another.
  getSessionIdentifier: (req) => req.cookies.token || '',
  // The default "__Host-" cookie name requires Secure (HTTPS); we run on http://localhost.
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: false, // true in production (HTTPS only)
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
  // GET, HEAD and OPTIONS are ignored by default ("safe" methods).
});

// Pre-auth routes run before a session exists, so they are exempt.
const CSRF_EXEMPT = ['/api/auth/login', '/api/auth/register'];

export function csrfProtection(req, res, next) {
  if (CSRF_EXEMPT.includes(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}
