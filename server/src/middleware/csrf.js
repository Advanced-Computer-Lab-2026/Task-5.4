import { doubleCsrf } from 'csrf-csrf';

const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'test-csrf-secret',
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    secure: false, // set to true in production (HTTPS)
    path: '/',
    httpOnly: true,
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

export { generateCsrfToken, doubleCsrfProtection };


