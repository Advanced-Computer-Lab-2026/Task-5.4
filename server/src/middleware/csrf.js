import { doubleCsrf } from 'csrf-csrf';

// Double-submit-cookie CSRF protection (csrf-csrf).
//
// GET /api/csrf-token hands the client a token AND sets a matching httpOnly
// cookie. Every state-changing request must echo the token in the
// `x-csrf-token` header. The attacker's page can make the browser send the
// cookie, but it can neither read the token (CORS blocks reading the response)
// nor set a custom header on a plain <form> POST, so a forged request fails.
//
// The token is HMAC-bound to the session (the auth cookie), so a token minted
// for one user/session is useless for another.
const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  getSessionIdentifier: (req) => req.cookies?.token ?? '',
  cookieName: 'csrf_token',
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

// Pre-auth routes run before a session exists, so there is nothing to forge
// "in the victim's name" yet — they stay exempt.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req, res, next) {
  if (EXEMPT_PATHS.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token
export function csrfTokenHandler(req, res) {
  res.json({ csrfToken: generateCsrfToken(req, res) });
}
