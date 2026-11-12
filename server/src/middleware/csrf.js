import { doubleCsrf } from 'csrf-csrf';

// CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// 1. The logged-in client calls GET /api/csrf-token. The server creates a
//    random token, signs it (HMAC) with CSRF_SECRET together with the user's
//    session identifier, stores it in a cookie, and also returns it in the body.
// 2. On every state-changing request the client sends the token back in the
//    `x-csrf-token` header. The server checks that the header matches the
//    cookie AND that the signature is valid for this session.
//
// An attacker's page can make the browser send the cookies, but it cannot read
// the token (CORS blocks reading the response) and cannot set custom headers on
// a plain <form> submit, so a forged request is rejected with 403.
const {
  invalidCsrfTokenError,
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // Read lazily so the secret comes from the environment (never hardcoded).
  getSecret: () => {
    if (!process.env.CSRF_SECRET) throw new Error('CSRF_SECRET is not set');
    return process.env.CSRF_SECRET;
  },
  // Bind the token to the authenticated session: the JWT in the auth cookie.
  // A token issued for one session is invalid for any other session.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    path: '/'
  },
  // The token is expected in this request header.
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
  // GET, HEAD and OPTIONS are ignored by default (safe methods).
});

export { invalidCsrfTokenError, generateCsrfToken, doubleCsrfProtection };
