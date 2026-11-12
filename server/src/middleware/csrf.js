import { doubleCsrf } from 'csrf-csrf';

export const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret: () => {
    if (!process.env.CSRF_SECRET) {
      throw new Error('CSRF_SECRET is required');
    }
    return process.env.CSRF_SECRET;
  },

  // Bind the CSRF token to this login session.
  getSessionIdentifier: (req) => req.cookies.token,

  cookieName: 'csrf-token',

  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // Local HTTP development.
    path: '/'
  },

  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});