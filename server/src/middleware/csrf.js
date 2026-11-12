import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// How it works:
//   1. The client calls GET /api/csrf-token. The server creates a random token
//      signed with CSRF_SECRET and tied to the user's session (their auth
//      cookie). It sends the token in the response body AND puts a copy in
//      a cookie.
//   2. On every state-changing request (POST/PATCH/DELETE) the client must send
//      the token back in the `x-csrf-token` header.
//   3. The server checks the header matches the cookie and the signature is
//      valid for this session. No match -> 403.
//
// Why the attacker can't pass this check: their page can make the browser
// SEND our cookies, but it cannot READ our responses or cookies (same-origin
// policy), and a plain HTML form cannot set custom headers. So the forged
// request arrives without a valid x-csrf-token header and is rejected.
export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by the tests).
  getSecret: () => process.env.CSRF_SECRET,
  // Bind each token to the logged-in session: a token issued for one user's
  // session is useless with another session.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    // Must be false over plain http://localhost; set true in production (https).
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  },
  // GET/HEAD/OPTIONS are "safe" (they change nothing) so they are not checked.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  // The client echoes the token in this header on every write.
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});
