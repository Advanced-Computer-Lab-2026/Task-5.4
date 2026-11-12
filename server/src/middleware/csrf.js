import { doubleCsrf } from 'csrf-csrf';

// Double-submit-cookie CSRF protection (the modern replacement for the
// deprecated `csurf`). The idea: on request the server hands the client a
// random token AND stores a keyed hash of it in a cookie. A state-changing
// request must then echo the token back in a header. The server recomputes the
// hash from the header token + its secret and checks it matches the cookie.
//
// An attacker's page CANNOT read our cookie (it belongs to our origin) and
// CANNOT read the token value from our JSON response (the same-origin policy
// blocks cross-site reads), so it cannot produce a matching header. That is the
// extra proof-of-origin that the auth cookie alone does not give us — which is
// precisely why CORS and SameSite do not, by themselves, close the CSRF hole.
const {
  generateToken,
  doubleCsrfProtection,
} = doubleCsrf({
  // Secret used to key the token hash. Kept in the environment, never shipped.
  getSecret: () => process.env.CSRF_SECRET,
  // A plain cookie name (no `__Host-` prefix) so it also works over plain
  // http://localhost during the demo. The cookie only holds the token *hash*.
  cookieName: 'csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    secure: false, // set true in production (HTTPS only)
    path: '/',
  },
  size: 64,
  // Where to read the client's echoed token from. This matches the
  // `x-csrf-token` header the client sends on every write.
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // GET/HEAD/OPTIONS are "safe" (no state change) and stay exempt by default.
});

export { generateToken, doubleCsrfProtection };
