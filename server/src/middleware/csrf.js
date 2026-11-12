import { doubleCsrf } from 'csrf-csrf';

// Signed double-submit-cookie CSRF protection (csrf-csrf).
//
// How it defeats the attack: the server hands the client a signed, per-session
// token (both in a cookie and in a JSON response). A state-changing request is
// only accepted if the `x-csrf-token` header matches the cookie and both verify
// against the server's secret. The attacker's page can make the browser send the
// cookie automatically, but it can neither READ the cookie (httpOnly) nor set a
// custom header on a cross-site form request — so it cannot produce a valid
// token. GET/HEAD/OPTIONS are exempt (they must not have side effects).
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  // Secret used to sign/verify the token. Falls back to JWT_SECRET so a single
  // random value suffices in development, but CSRF_SECRET takes priority.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,

  // Bind the token to the current session. We have no server-side session, so we
  // use the JWT auth cookie itself. It is never sent to the client's JS, so the
  // attacker cannot read it to forge a matching token.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',

  // No __Host- prefix and secure:false — required for plain http://localhost.
  cookieName: 'csrf_token',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    secure: false, // true in production (HTTPS only)
    httpOnly: true
  },

  // The token must come from the header, never from the cookie (using the cookie
  // would be equivalent to having no protection at all).
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

export { generateCsrfToken, doubleCsrfProtection };
