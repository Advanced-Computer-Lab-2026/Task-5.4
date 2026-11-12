
import { doubleCsrf } from 'csrf-csrf';
import { createHash } from 'node:crypto';

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,

  getSessionIdentifier: (req) =>
    createHash('sha256')
      .update(req.cookies?.token || '')
      .digest('hex'),

  cookieName: 'csrf-token',

  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  },

  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

export { generateCsrfToken, doubleCsrfProtection };
