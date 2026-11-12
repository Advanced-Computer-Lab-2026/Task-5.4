import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// How it works:
//   1. The client calls GET /api/csrf-token. The server generates a token that is
//      an HMAC (signed with CSRF_SECRET) bound to the user's session, sets it in
//      an httpOnly cookie AND returns it in the JSON body.
//   2. On every state-changing request the client echoes the token back in the
//      `x-csrf-token` header. The server checks header === cookie and that the
//      HMAC is valid for this session.
//
// Why the attacker fails: a forged cross-site form/fetch carries the cookies
// automatically, but it cannot READ the token (CORS blocks reading our
// response, and the cookie is httpOnly), so it cannot set the header.
// A plain HTML <form> cannot set custom headers at all.

// Routes that run before a session exists, so they cannot have a token yet.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by tests at runtime).
  getSecret: () => {
    const secret = process.env.CSRF_SECRET;
    if (!secret) throw new Error('CSRF_SECRET is not set (add it to server/.env)');
    return secret;
  },
  // Bind each token to the logged-in session (the JWT cookie), so a token
  // issued for one session is useless for another.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  // The default "__Host-" prefixed name requires HTTPS; we run on http://localhost.
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  // GET / HEAD / OPTIONS are "safe" and ignored by default.
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => EXEMPT_PATHS.has(req.path)
});

// GET /api/csrf-token — hands the client a fresh token (and sets its cookie).
export function csrfTokenHandler(req, res) {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
}

export { doubleCsrfProtection };
