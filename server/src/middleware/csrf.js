import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the (signed) double-submit-cookie pattern.
//
// How it works:
//   1. The client calls GET /api/csrf-token. The server generates a random
//      token, HMAC-signs it with CSRF_SECRET + the user's session identifier,
//      stores it in a cookie, and ALSO returns it in the JSON body.
//   2. On every state-changing request the client copies that token into the
//      `x-csrf-token` header.
//   3. The server checks that the header token matches the cookie AND that its
//      signature is valid for this secret and this session.
//
// Why the attacker cannot pass this check:
//   - The browser attaches cookies automatically, but it never adds custom
//     headers to a cross-site <form> POST, and a cross-site fetch() that tries
//     to set `x-csrf-token` triggers a CORS preflight that our CORS policy
//     refuses (only http://localhost:5175 is allowed).
//   - The attacker cannot READ the token either: the response of
//     GET /api/csrf-token is protected by CORS, and the cookie is httpOnly.
//   - The token is bound to the session (the auth cookie), so a token obtained
//     for a different session (e.g. the attacker's own account) is rejected.
const {
  doubleCsrfProtection,
  generateCsrfToken
} = doubleCsrf({
  getSecret: () => {
    const secret = process.env.CSRF_SECRET;
    if (!secret) throw new Error('CSRF_SECRET is not set');
    return secret;
  },
  // Bind the token to the current login session. Before login there is no
  // auth cookie, so anonymous visitors share the empty identifier — that is
  // fine because the only anonymous writes (login/register) are exempt below.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',
  // Not the default `__Host-` prefixed name: that prefix requires `Secure`,
  // which browsers refuse to set over plain http://localhost in development.
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // Safe methods never change state, so they do not need a token.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  // The client sends the token in this header (the default, made explicit).
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // Pre-auth routes run before any session exists, so there is nothing to
  // forge "in the victim's name" yet — exempt them.
  skipCsrfProtection: (req) =>
    req.method === 'POST' && ['/api/auth/login', '/api/auth/register'].includes(req.path)
});

// GET /api/csrf-token — hands the client a token for its current session.
export function csrfTokenHandler(req, res) {
  // overwrite: true issues a fresh token, so a token minted before login is
  // replaced by one bound to the new session.
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  res.json({ csrfToken });
}

export { doubleCsrfProtection };
