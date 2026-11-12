import { doubleCsrf } from 'csrf-csrf';

// Anti-CSRF protection using the double-submit-cookie pattern (csrf-csrf).
//
// GET /api/csrf-token hands the client a token and also stores it in an
// httpOnly cookie. Every state-changing request must then echo that token back
// in the `x-csrf-token` header. The server accepts the request only if:
//   - the header and the cookie hold the same token, and
//   - the token's HMAC is valid for our secret AND for the caller's session.
//
// Why this stops the attacker: a forged cross-site request still carries the
// victim's cookies (the browser attaches them automatically), but the attacker
// page can neither read the token (CORS blocks reading our responses and the
// cookie is httpOnly) nor set a custom header on a plain HTML <form> POST.
// CORS and SameSite alone do not give this guarantee: CORS only hides the
// response, and SameSite does not apply between ports of the same site.

const isProduction = process.env.NODE_ENV === 'production';

// Routes that run before a session exists. There is no auth cookie for an
// attacker to ride on yet, so they are exempt (the client has no session-bound
// token to send at this point either).
const PRE_AUTH_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  // Read lazily so the secret comes from the environment at request time.
  getSecret: () => {
    const secret = process.env.CSRF_SECRET;
    if (!secret) throw new Error('CSRF_SECRET is not set');
    return secret;
  },
  // Bind each token to the session: the JWT auth cookie. A token issued for one
  // session (or before login) is rejected for any other session.
  getSessionIdentifier: (req) => req.cookies?.token ?? '',
  // The `__Host-` prefix requires a Secure cookie, which needs HTTPS.
  cookieName: isProduction ? '__Host-dorm.x-csrf-token' : 'dorm.x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction, // HTTPS only in production
    path: '/'
  },
  // "Safe" methods never change state, so they never need a token.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  // Only accept the token from a custom header — never from the body, which a
  // forged HTML form could fill in.
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => PRE_AUTH_PATHS.has(req.path)
});

export const csrfProtection = doubleCsrfProtection;

// GET /api/csrf-token — issue (or re-issue) the token for the current session.
export function csrfTokenHandler(req, res, next) {
  try {
    // A per-session secret must never be served from an HTTP cache.
    res.set('Cache-Control', 'no-store');
    res.json({ csrfToken: generateCsrfToken(req, res) });
  } catch (err) { next(err); }
}

export function isCsrfError(err) {
  return err === invalidCsrfTokenError || err?.code === 'EBADCSRFTOKEN';
}
