import { doubleCsrf } from 'csrf-csrf';

const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  // CSRF_SECRET should be independent from the JWT secret in production. The
  // fallback keeps local development compatible with the existing .env file.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Binding the token to the JWT makes it unique to the logged-in session.
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // These routes establish a session, so no per-session token exists yet.
  skipCsrfProtection: (req) => (
    req.path === '/api/auth/login' || req.path === '/api/auth/register'
  )
});

export function issueCsrfToken(req, res) {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
}

export { doubleCsrfProtection };
