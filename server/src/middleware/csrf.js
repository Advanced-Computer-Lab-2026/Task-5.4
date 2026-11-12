import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

const fallbackSecret = randomBytes(32).toString('hex');
const production = process.env.NODE_ENV === 'production';

export const csrfCookieName = production ? '__Host-csrf-token' : 'csrf-token';
export const csrfCookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: 'strict',
  path: '/'
};

export const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  // Configure a shared CSRF_SECRET when running multiple API instances.
  getSecret: () => process.env.CSRF_SECRET || fallbackSecret,
  getSessionIdentifier: (req) => req.cookies.token || '',
  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,
  getCsrfTokenFromRequest: (req) => req.get('x-csrf-token')
});
