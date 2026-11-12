import crypto from 'crypto';

// Double-submit cookie CSRF protection.
// A random token is stored in a JS-readable cookie; the client echoes it in the
// X-CSRF-Token header. A cross-site attacker can make the browser send the
// cookie but cannot read it, so cannot produce a matching header.

export function setCsrfCookie(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrfToken', token, {
    httpOnly: false, // the client must read it
    sameSite: 'lax',
    secure: false, // true in production (HTTPS only)
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return token;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// These issue the token (and need no session yet), so they are exempt.
const EXEMPT_PATHS = new Set(['/auth/login', '/auth/register']);

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) return next();

  const cookie = req.cookies?.csrfToken;
  const header = req.get('x-csrf-token');
  if (!cookie || !header) return res.status(403).json({ message: 'CSRF token missing' });

  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  next();
}
