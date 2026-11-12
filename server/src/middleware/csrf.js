
import { doubleCsrf } from 'csrf-csrf';

export const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret: () => {
    const secret = process.env.CSRF_SECRET;

    if (!secret) {
      throw new Error('CSRF_SECRET is not set');
    }

    return secret;
  },

  // Connect the CSRF token to the user's session
  getSessionIdentifier: (req) => {
    return req.cookies?.token || '';
  },

  cookieName: 'csrf-token',

  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },

  getCsrfTokenFromRequest: (req) => {
    return req.headers['x-csrf-token'];
  }
});
