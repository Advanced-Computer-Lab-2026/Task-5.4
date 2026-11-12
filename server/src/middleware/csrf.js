import { doubleCsrf } from 'csrf-csrf';

const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // A separate CSRF_SECRET is recommended. Reusing the already-random JWT
  // secret keeps existing development environments working until it is added.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Binding the token to the JWT makes it specific to the current login
  // session rather than merely specific to the browser.
  getSessionIdentifier: (req) => req.cookies?.token || 'anonymous',
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

const PRE_AUTH_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/register'
]);

// Login and registration run before a session exists. All other unsafe
// methods pass through csrf-csrf; GET, HEAD and OPTIONS are ignored by the
// library's safe-method defaults.
export function protectFromCsrf(req, res, next) {
  if (PRE_AUTH_ROUTES.has(req.path)) return next();
  return doubleCsrfProtection(req, res, next);
}

export function issueCsrfToken(req, res) {
  res.json({ csrfToken: generateCsrfToken(req, res) });
}
