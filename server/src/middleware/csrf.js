
import { doubleCsrf } from 'csrf-csrf';

const isProduction = process.env.NODE_ENV === 'production';

export const csrfCookieName = isProduction
  ? '__Host-app.csrf'
  : 'app.csrf';

export const csrfCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/'
};

export const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret: () => {
    if (!process.env.CSRF_SECRET) {
      throw new Error('CSRF_SECRET is not configured');
    }

    return process.env.CSRF_SECRET;
  },

  getSessionIdentifier: (req) => {
    if (!req.user?.jti) {
      throw new Error('Missing authenticated session identifier');
    }

    return req.user.jti;
  },

  cookieName: csrfCookieName,
  cookieOptions: csrfCookieOptions,

  getCsrfTokenFromRequest: (req) =>
    req.headers['x-csrf-token']
});
