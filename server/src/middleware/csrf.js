import { doubleCsrf } from 'csrf-csrf';

const secure = process.env.NODE_ENV === 'production';
const cookieName = secure ? '__Host-dorm-csrf' : 'dorm-csrf';
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure, path: '/' };

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  getSessionIdentifier: (req) => req.cookies.token,
  cookieName,
  cookieOptions
});

export const requireCsrf = doubleCsrfProtection;

export function issueCsrfToken(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: generateCsrfToken(req, res) });
}

export function clearCsrfCookie(res) {
  res.clearCookie(cookieName, cookieOptions);
}
