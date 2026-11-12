import { doubleCsrf } from 'csrf-csrf';

// Pre-auth routes: they run before a session exists, so there is nothing for a
// forged request to ride on and no session to bind a token to.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

// Double-submit-cookie CSRF protection.
//
// The server hands out a random token twice: once in an httpOnly cookie (as an
// HMAC signed with CSRF_SECRET and bound to the session) and once in the body
// of GET /api/csrf-token. Our own client reads the body and echoes the token in
// the `x-csrf-token` header on every write. An attacker's page can make the
// browser SEND the cookies, but it cannot READ the token (CORS blocks reading
// the response, httpOnly blocks reading the cookie) and a plain HTML form
// cannot set a custom header — so its forged request never carries a match.
const { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError } = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by the tests).
  getSecret: () => process.env.CSRF_SECRET,
  // Bind the token to the logged-in session: a token issued for one session
  // (or for an anonymous visitor) is useless with another session's cookie.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // "Safe" methods must never change state, so they need no token.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  // Only accept the token from the header — never from the body or query,
  // which a forged form could populate.
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => EXEMPT_PATHS.has(req.path)
});

// GET /api/csrf-token — issues a token for the current session.
export function csrfToken(req, res) {
  res.json({ csrfToken: generateCsrfToken(req, res) });
}

export { doubleCsrfProtection, invalidCsrfTokenError };
