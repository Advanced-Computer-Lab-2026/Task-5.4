import { doubleCsrf } from 'csrf-csrf';

// Pre-auth routes run before a session exists, so there is nothing to forge yet
// (and "login CSRF" is not what this task protects against). Everything else
// that changes state is protected, including logout and the booking/user writes.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

const {
  doubleCsrfProtection,
  generateCsrfToken,
  invalidCsrfTokenError
} = doubleCsrf({
  // Read lazily (per request): ESM hoists imports, so dotenv has not run yet when
  // this module loads, and the tests set CSRF_SECRET after importing the app.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind the CSRF token to the session: it is only valid together with the JWT
  // cookie it was issued for. A token minted for someone else (or for no session)
  // is rejected, which also defeats "cookie tossing" from another origin.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'csrf_token', // plain name: the __Host- prefix needs HTTPS
  cookieOptions: { sameSite: 'lax', secure: false, httpOnly: true, path: '/' }, // secure:true in production
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // GET/HEAD/OPTIONS are "safe" methods and stay exempt (defaults).
  skipCsrfProtection: (req) => EXEMPT_PATHS.has(req.originalUrl.split('?')[0]),
  errorConfig: { statusCode: 403, message: 'Invalid or missing CSRF token', code: 'EBADCSRFTOKEN' }
});

export { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError };
