import { doubleCsrf } from 'csrf-csrf';

const production = process.env.NODE_ENV === 'production';

export const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind the signature to this login's JWT, rather than the user's identity.
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName: production ? '__Host-csrf-token' : 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.get('x-csrf-token')
});
