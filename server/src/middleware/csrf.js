import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

// A random development fallback; configure CSRF_SECRET for shared deployments.
const fallbackSecret = randomBytes(32).toString('hex');
const production = process.env.NODE_ENV === 'production';
export const csrfCookieName = production ? '__Host-csrf' : 'csrf';
export const csrfCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: production,
  path: '/'
};

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || fallbackSecret,
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

export const csrfProtection = doubleCsrfProtection;

export function issueCsrfToken(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: generateCsrfToken(req, res) });
}
