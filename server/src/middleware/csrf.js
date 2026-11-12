import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

const developmentSecret = randomBytes(32).toString('hex');
const production = process.env.NODE_ENV === 'production';

export const csrfCookieName = production ? '__Host-csrf-token' : 'csrf-token';
export const csrfCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: production,
  path: '/'
};

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => {
    if (process.env.CSRF_SECRET) return process.env.CSRF_SECRET;
    if (production) throw new Error('CSRF_SECRET is required in production');
    return developmentSecret;
  },
  // Bind the HMAC to this login session, rather than only to a user ID.
  getSessionIdentifier: req => req.cookies?.token || '',
  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,
  getCsrfTokenFromRequest: req => req.get('x-csrf-token')
});
