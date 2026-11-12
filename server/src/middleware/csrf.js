import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the signed double-submit-cookie pattern (csrf-csrf).
//
// 1. The client calls GET /api/csrf-token. The server creates a random value,
//    signs it with CSRF_SECRET together with the current session (the JWT
//    cookie), returns the token in the JSON body AND stores it in an httpOnly
//    cookie.
// 2. On every state-changing request the client echoes the token back in the
//    `x-csrf-token` header. The middleware checks that the header equals the
//    cookie and that the HMAC is valid for the *current* session.
//
// Why this stops CSRF: the attacker's page can make the browser *send* our
// cookies, but it cannot *read* the token (CORS blocks reading our responses,
// and the cookie is httpOnly), and a plain HTML <form> cannot set custom
// headers. Because the token is bound to the session, a token issued for one
// user/session is useless for another.

export const CSRF_HEADER = 'x-csrf-token';

// Routes that run before a session exists, so there is nothing to forge yet.
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  // Read lazily so the secret can come from .env (or be set by tests) after import.
  getSecret: () => {
    const secret = process.env.CSRF_SECRET;
    if (!secret) throw new Error('CSRF_SECRET is not set');
    return secret;
  },
  // Bind each token to the user's session: the JWT in the auth cookie.
  // Logging in/out changes this value, so the client must fetch a new token.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: false, // true in production (HTTPS only), like the auth cookie
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers[CSRF_HEADER],
  // GET/HEAD/OPTIONS are "safe" and never change state, so they are ignored.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  skipCsrfProtection: (req) => EXEMPT_PATHS.has(req.path)
});

// Mounted app-wide: every POST/PATCH/PUT/DELETE must carry a valid token.
export const csrfProtection = doubleCsrfProtection;

// GET /api/csrf-token — hands the token to our own client (CORS stops other
// origins from reading this response).
export function sendCsrfToken(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: generateCsrfToken(req, res) });
}
