import { randomBytes } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

// A process-local fallback keeps development usable without a committed secret.
// Set CSRF_SECRET consistently across instances in production.
const fallbackSecret = randomBytes(32).toString('hex');
export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || fallbackSecret,
  getSessionIdentifier: (req) => req.cookies.token || '',
  cookieName: process.env.NODE_ENV === 'production' ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});
