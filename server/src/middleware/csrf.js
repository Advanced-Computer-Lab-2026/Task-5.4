import { doubleCsrf } from 'csrf-csrf';

const isProduction = () => process.env.NODE_ENV === 'production';

// Dev-only fallback so `npm run dev` works without extra setup. In production
// CSRF_SECRET must be set (see getSecret below).
const DEV_CSRF_SECRET = 'dev-only-csrf-secret-change-me';

// Requests that run before a session exists (there is no session to forge
// against yet, and the client has nothing to bind a token to).
const EXEMPT_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/auth/register'
]);

// Built on first use rather than at import time, so NODE_ENV/CSRF_SECRET from
// .env (or set by tests) are honoured. Built once and reused, so the cookie name
// and options are identical when generating and when validating tokens.
let csrfUtils = null;

function getCsrfUtils() {
  if (csrfUtils) return csrfUtils;
  const production = isProduction();
  csrfUtils = doubleCsrf({
    // Read lazily on every request so the secret can be provided after the app
    // module has been imported (e.g. by dotenv in index.js, or by the tests).
    getSecret: () => {
      if (process.env.CSRF_SECRET) return process.env.CSRF_SECRET;
      if (isProduction()) throw new Error('CSRF_SECRET is not set');
      return DEV_CSRF_SECRET;
    },
    // Bind every token to the current session (the auth cookie), so a token
    // issued for one session is useless in another. Anonymous visitors share ''.
    getSessionIdentifier: (req) => req.cookies?.token || '',
    // The `__Host-` prefix makes the browser refuse the cookie unless it is Secure,
    // has Path=/ and no Domain, so we only use it in production (served over HTTPS).
    cookieName: production ? '__Host-dorm.x-csrf-token' : 'dorm.x-csrf-token',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: production,
      path: '/'
    },
    // GET/HEAD/OPTIONS are "safe" and never change state, so they are exempt.
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    // Only accept the token from a custom header. A cross-site HTML form cannot
    // set headers, and a cross-site fetch that tries to is blocked by CORS.
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
    skipCsrfProtection: (req) => {
      const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
      return EXEMPT_ROUTES.has(`${req.method} ${path}`);
    },
    errorConfig: { statusCode: 403, message: 'Invalid CSRF token', code: 'EBADCSRFTOKEN' }
  });
  return csrfUtils;
}

export function doubleCsrfProtection(req, res, next) {
  return getCsrfUtils().doubleCsrfProtection(req, res, next);
}

// GET /api/csrf-token
// Issues (or re-issues) the token: the signed value goes into an httpOnly cookie
// and is also returned in the body for the client to echo in `x-csrf-token`.
export function csrfTokenHandler(req, res, next) {
  try {
    const csrfToken = getCsrfUtils().generateCsrfToken(req, res);
    res.json({ csrfToken });
  } catch (err) { next(err); }
}
