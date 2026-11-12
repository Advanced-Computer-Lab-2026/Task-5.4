import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

const production = process.env.NODE_ENV === 'production';
const developmentSecret = randomBytes(32).toString('hex');
const cookieName = production ? '__Host-csrf-token' : 'csrf-token';
const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: 'strict',
  path: '/'
};

export const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => {
    if (process.env.CSRF_SECRET) return process.env.CSRF_SECRET;
    if (production) throw new Error('CSRF_SECRET must be set in production');
    return developmentSecret;
  },
  // The verified JWT identifies this login session, not just the user account.
  // Authentication must run before token generation or validation.
  getSessionIdentifier: req => req.cookies.token,
  cookieName,
  cookieOptions,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: req => req.get('x-csrf-token')
});

export function clearCsrfCookie(res) {
  res.clearCookie(cookieName, cookieOptions);
}
