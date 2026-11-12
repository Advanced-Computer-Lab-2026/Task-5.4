import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';
import { requireAuth } from './auth.js';

const production = process.env.NODE_ENV === 'production';
const developmentSecret = randomBytes(32).toString('hex');
const cookieName = production ? '__Host-csrf-token' : 'csrf-token';
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: production, path: '/' };

const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => {
    if (process.env.CSRF_SECRET) return process.env.CSRF_SECRET;
    if (production) throw new Error('CSRF_SECRET is required in production');
    return developmentSecret;
  },
  // requireAuth verifies the JWT first. Each new login has a distinct JWT ID.
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName,
  cookieOptions,
  getCsrfTokenFromRequest: (req) => req.get('x-csrf-token')
});

export const authenticatedWrite = [requireAuth, doubleCsrfProtection];
export { invalidCsrfTokenError };

export function issueCsrfToken(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: generateCsrfToken(req, res) });
}

export function clearCsrfCookie(res) {
  res.clearCookie(cookieName, cookieOptions);
}
