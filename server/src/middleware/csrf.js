import crypto from 'crypto';
import { doubleCsrf } from 'csrf-csrf';

// Used only when CSRF_SECRET is not configured: a random secret that lives for
// this process. Still unguessable, but tokens stop validating after a restart.
let fallbackSecret;
function getSecret() {
  if (process.env.CSRF_SECRET) return process.env.CSRF_SECRET;
  if (!fallbackSecret) {
    console.warn('CSRF_SECRET is not set; using a random per-process secret. Set it in server/.env.');
    fallbackSecret = crypto.randomBytes(32).toString('hex');
  }
  return fallbackSecret;
}

// These run before a session exists, so there is no authenticated state for a
// forged request to abuse and no session to bind a token to.
const PRE_AUTH_ROUTES = new Set(['/api/auth/login', '/api/auth/register']);

// Double-submit cookie pattern. The server signs a random token (HMAC keyed by
// the secret and bound to the session) and stores it in a cookie; the client
// must echo the same token in the x-csrf-token header. A cross-site page can
// make the browser send the cookie, but it can neither read the token (CORS
// blocks reading /api/csrf-token) nor set a custom header on a plain form POST.
const { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError } = doubleCsrf({
  getSecret,
  // Bind the token to the logged-in session (the auth cookie), so a token
  // obtained by one user/session cannot be replayed against another.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  // The "__Host-" prefix requires HTTPS; use it (with secure: true) in production.
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true, // the client gets the token from the JSON body, not the cookie
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // Safe methods must not change state, so they need no token.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  // Header only: a cross-site HTML form cannot set custom headers, and never
  // accept the token from the body or query string.
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => PRE_AUTH_ROUTES.has(req.path)
});

// GET /api/csrf-token — hands the client a token for the current session.
export function sendCsrfToken(req, res) {
  res.json({ csrfToken: generateCsrfToken(req, res) });
}

export { doubleCsrfProtection, invalidCsrfTokenError };
