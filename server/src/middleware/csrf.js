import { doubleCsrf } from 'csrf-csrf';

function getSecret() {
  const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('Set CSRF_SECRET or JWT_SECRET to a strong secret');
  return secret;
}

const csrf = doubleCsrf({
  getSecret,
  // Binding the token to the exact signed-in JWT keeps it session-specific.
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  }
});

export const csrfProtection = csrf.doubleCsrfProtection;
export const generateCsrfToken = csrf.generateCsrfToken;
