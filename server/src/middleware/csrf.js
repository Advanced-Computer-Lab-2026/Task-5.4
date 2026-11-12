import { doubleCsrf } from 'csrf-csrf';

const production = process.env.NODE_ENV === 'production';

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Called only after requireAuth has verified this session cookie.
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName: production ? '__Host-csrf-token' : 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: production,
    sameSite: 'strict',
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});
