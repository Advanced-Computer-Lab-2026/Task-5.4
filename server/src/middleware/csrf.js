import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

const localSecret = randomBytes(32).toString('hex');
export const csrfCookieName = process.env.NODE_ENV === 'production'
  ? '__Host-dorm.csrf'
  : 'dorm.csrf';
export const csrfCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
};

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => {
    if (process.env.CSRF_SECRET) return process.env.CSRF_SECRET;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CSRF_SECRET is required in production');
    }
    // A random process-local secret keeps local development usable without .env.
    return localSecret;
  },
  // Only used after requireAuth verifies this JWT. Each login gets a unique JWT.
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.get('x-csrf-token')
});

export function clearCsrfCookie(res) {
  res.clearCookie(csrfCookieName, csrfCookieOptions);
}
