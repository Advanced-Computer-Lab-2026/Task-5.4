import { doubleCsrf } from 'csrf-csrf';

// Signed double-submit-cookie CSRF protection, bound to the user's session
// (the auth JWT cookie). The attacker's site can neither read the token nor
// mint one that matches the victim's session.
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET || 'dev-csrf-secret',
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'csrf-token',
  cookieOptions: { sameSite: 'lax', secure: false, httpOnly: true, path: '/' },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // Pre-auth routes run before a session exists, so there is nothing to bind to.
  skipCsrfProtection: (req) =>
    req.path === '/api/auth/login' || req.path === '/api/auth/register'
});

export { generateCsrfToken, doubleCsrfProtection };

// GET /api/csrf-token
export function csrfTokenHandler(req, res) {
  res.json({ csrfToken: generateCsrfToken(req, res) });
}
