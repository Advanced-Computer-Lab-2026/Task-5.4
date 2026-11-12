import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { doubleCsrfProtection } from './csrf.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    // Bind to the verified JWT, never just to the account ID. Hashing also
    // supports existing JWTs issued before the addition of random jti values.
    req.authSessionId = createHash('sha256').update(token).digest('hex');
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  return doubleCsrfProtection(req, res, next);
}
