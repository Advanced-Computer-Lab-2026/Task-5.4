import { createHash, createHmac } from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';

const isProduction = process.env.NODE_ENV === 'production';

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () =>
    createHmac('sha256', process.env.JWT_SECRET)
      .update('dorm-booking-csrf')
      .digest('hex'),

  getSessionIdentifier: (req) =>
    createHash('sha256').update(req.cookies.token).digest('hex'),

  cookieName: isProduction ? '__Host-csrf-token' : 'csrf-token',

  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  },

  getCsrfTokenFromRequest: (req) => req.get('X-CSRF-Token')
});

export const requireCsrf = doubleCsrfProtection;

export function issueCsrfToken(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: generateCsrfToken(req, res) });
}