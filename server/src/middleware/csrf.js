import { doubleCsrf } from 'csrf-csrf';

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // The signed auth JWT is the session identifier; rotating it on login/register
  // also rotates the CSRF token's binding.
  getSessionIdentifier: (req) => req.cookies?.token || 'anonymous',
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.get('x-csrf-token'),
  skipCsrfProtection: (req) =>
    req.method === 'POST' &&
    ['/api/auth/login', '/api/auth/register'].includes(req.path)
});

export { doubleCsrfProtection, generateCsrfToken };
