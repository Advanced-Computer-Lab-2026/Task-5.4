
import { doubleCsrf } from 'csrf-csrf';

const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // Server-side secret used to sign CSRF tokens.
  getSecret: () => process.env.CSRF_SECRET,

  // Bind each CSRF token to the user's authenticated JWT session.
  getSessionIdentifier: (req) => req.cookies.token,

  cookieName: 'csrf-token',

  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/'
  },

  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],

  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

export { generateCsrfToken, doubleCsrfProtection };
