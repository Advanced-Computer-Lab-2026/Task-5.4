import { doubleCsrf } from 'csrf-csrf';

// Double-submit-cookie CSRF protection (csrf-csrf).
//
// The server hands the client a random token twice: once in an httpOnly cookie
// (HMAC-signed with a server secret and bound to the session) and once in the
// JSON body of GET /api/csrf-token. On every state-changing request the client
// must echo the token back in the `x-csrf-token` header. An attacker's page can
// make the browser SEND the cookies, but it cannot READ the token (CORS blocks
// reading the response) and a plain HTML form cannot set a custom header — so a
// forged request never carries a matching header and is refused with 403.
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind the token to the session (the auth cookie), so a token minted for one
  // session cannot be replayed on another.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  // No "__Host-" prefix here: that prefix requires Secure (HTTPS), and the demo
  // runs over http://localhost. In production use "__Host-..." + secure: true.
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // Safe (read-only) methods are exempt; every other method needs the token.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // Login/register run BEFORE a session exists, so there is nothing to forge
  // against yet and no session to bind a token to — they stay exempt.
  skipCsrfProtection: (req) =>
    req.method === 'POST' && ['/api/auth/login', '/api/auth/register'].includes(req.path)
});

// GET /api/csrf-token — issue a token for the current session.
export function csrfToken(req, res) {
  res.json({ csrfToken: generateCsrfToken(req, res) });
}

export { doubleCsrfProtection };
