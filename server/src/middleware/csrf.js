const CSRF_HEADER = 'x-csrf-token';

export function requireCsrfToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const submitted = req.headers[CSRF_HEADER];
  const cookieValue = req.cookies?.csrfToken;

  if (!submitted || !cookieValue || submitted !== cookieValue) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  return next();
}
