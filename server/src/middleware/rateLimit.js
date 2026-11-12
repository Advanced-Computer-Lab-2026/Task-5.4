import rateLimit from 'express-rate-limit';

const base = { standardHeaders: 'draft-7', legacyHeaders: false };

// Broad limit for every API request, per IP.
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: { message: 'Too many requests, slow down.' }
});

// Strict limit on login/register: stops brute force and bcrypt CPU abuse.
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many attempts, try again later.' }
});

// Tighter limit on writes (create/update/delete).
export const writeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 30,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: { message: 'Too many write requests, slow down.' }
});
