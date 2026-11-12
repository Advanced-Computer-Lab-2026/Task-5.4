import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// How it works:
//   1. GET /api/csrf-token returns a token in the JSON body and also sets a
//      companion httpOnly cookie. Both derive from an HMAC over the server-only
//      CSRF_SECRET and the caller's session identifier (the auth JWT cookie).
//   2. Every state-changing request (POST/PUT/PATCH/DELETE) must send that
//      token back in the `x-csrf-token` header. The server re-computes the HMAC
//      and checks that the header token matches the cookie and the session.
//
// Why an attacker's page can't get past this:
//   - It cannot *read* the token. The token only comes back in a response
//     body, and the Same-Origin Policy/CORS stop another origin's script from
//     reading our responses.
//   - It cannot *guess* it. Making a valid token needs CSRF_SECRET, and the
//     token is tied to the victim's own session.
//   - It cannot *send* it. A plain HTML <form> can't set custom headers. A
//     cross-origin fetch() that sets one triggers a CORS preflight, and our
//     CORS policy only allows the real client origin.
//
// Why CORS and SameSite alone are not enough:
//   - CORS controls who may READ a response, not who may SEND a request. A
//     "simple" request (a form POST with urlencoded body) skips preflight
//     entirely, and the server acts on it before the browser drops the reply.
//   - SameSite keys off the registrable domain ("site"), not the origin. Here
//     localhost:1337 and localhost:4000 are the same site, so a Lax cookie still
//     rides along. Any sibling subdomain would count as same-site too, and so
//     would a top-level GET navigation under Lax.

const isProd = process.env.NODE_ENV === 'production';

// Requests that may proceed without a CSRF token:
//   - Safe methods (GET/HEAD/OPTIONS): by convention they never change state, so
//     there's nothing to forge. (csrf-csrf ignores these by default.)
//   - Pre-auth routes: login/register run *before* a session exists, so there's
//     no session to tie a token to and no ambient credential to abuse yet.
// Logout is NOT exempt. It runs against a live session and changes state, so a
//   forged logout would be a (low-impact) CSRF too.
const CSRF_EXEMPT_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/auth/register'
]);

const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by tests) after
  // this module loads.
  getSecret: () => {
    const secret = process.env.CSRF_SECRET;
    if (!secret) throw new Error('CSRF_SECRET is not set');
    return secret;
  },
  // Tie each token to the current session, so a token issued for one session
  // (e.g. the attacker's own account) is useless against another. With no
  // session yet the identifier is empty, so the token must be re-fetched after
  // login/register.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  // Browsers only accept the __Host- prefix on Secure cookies (HTTPS), so the
  // unprefixed name is for local http:// development.
  cookieName: isProd ? '__Host-x-csrf-token' : 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/'
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  // Header only. Never accept the token from the body: a forged HTML form can
  // put anything in its body, but it can't set a custom header.
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => CSRF_EXEMPT_ROUTES.has(`${req.method} ${req.path}`),
  errorConfig: {
    statusCode: 403,
    message: 'Invalid or missing CSRF token',
    code: 'EBADCSRFTOKEN'
  }
});

export const csrfProtection = doubleCsrfProtection;

// GET /api/csrf-token: hand the client a token for its current session.
// If the existing CSRF cookie is still valid for this session, it's reused, so
// several open tabs share one token instead of invalidating each other. If not
// (no cookie yet, or the session changed after login/logout), a new one is
// made.
export function issueCsrfToken(req, res) {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
}
