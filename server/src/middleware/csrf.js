import { doubleCsrf } from 'csrf-csrf';

const isProduction = process.env.NODE_ENV === 'production';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  getSessionIdentifier: (req) => req.cookies?.token || 'anonymous',
  cookieName: isProduction ? '__Host-csrf-token' : 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) =>
    req.method === 'POST' &&
    (req.path === '/api/auth/login' || req.path === '/api/auth/register')
});

export { doubleCsrfProtection, generateCsrfToken };
