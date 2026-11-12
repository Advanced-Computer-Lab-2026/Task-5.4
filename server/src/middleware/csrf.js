import { doubleCsrf } from 'csrf-csrf';

const PRE_AUTH = ['/api/auth/login', '/api/auth/register'];

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'x-csrf-token',
  cookieOptions: { httpOnly: true, secure: false, sameSite: 'lax', path: '/' },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  skipCsrfProtection: (req) => PRE_AUTH.includes(req.path),
});