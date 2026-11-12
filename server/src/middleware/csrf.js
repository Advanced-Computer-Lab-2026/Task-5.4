import { doubleCsrf } from 'csrf-csrf';

const isProd = process.env.NODE_ENV === 'production';

// Signed double-submit cookie pattern:
//   - GET /api/csrf-token returns a token AND sets a cookie holding its HMAC.
//   - Every state-changing request must echo the token in the `x-csrf-token`
//     header. The server checks header and cookie match and were signed for
//     this session.
// An attacker's page can make the browser *send* our cookies, but it cannot
// *read* the token (CORS blocks reading the response) and a plain HTML form
// cannot set a custom header, so a forged request never carries a valid token.
export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  // Read lazily: in ESM, app.js is imported before dotenv.config() runs, and the
  // tests set process.env.CSRF_SECRET after importing the app.
  getSecret: () => process.env.CSRF_SECRET,

  // Bind each token to the user's session (the auth JWT cookie). Without this,
  // a token issued to one session (e.g. the attacker's own account, or a
  // logged-out visitor) would also be accepted for the victim's session.
  // Side effect: a token fetched before login is invalid after login, so the
  // client must fetch a fresh one once it has a session.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',

  // No `__Host-` prefix: that prefix requires `secure`, which plain
  // http://localhost can't satisfy.
  cookieName: 'csrf_token',
  cookieOptions: {
    httpOnly: true,   // client JS never needs the cookie; it uses the JSON token
    sameSite: 'lax',  // extra layer (but :1337 and :4000 are the same site!)
    secure: isProd,   // HTTPS only in production
    path: '/'
  },

  // Safe methods are skipped (this is also the package default).
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],

  // Only accept the token from the header — never from the body, otherwise a
  // forged <form> could just include it as a field.
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});
