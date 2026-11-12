import { rateLimit } from 'express-rate-limit';

const ONE_MINUTE = 60 * 1000;

// Every maintenance request (reads included) counts against this budget, so a
// single client cannot flood the endpoints and starve everyone else.
export const maintenanceLimiter = rateLimit({
  windowMs: ONE_MINUTE,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { message: 'Too many requests, please try again later.' }
});

// Writes hit the database harder and are rarer in legitimate use, so they get a
// tighter, separate budget on top of the one above. Safe methods are not counted.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const maintenanceWriteLimiter = rateLimit({
  windowMs: ONE_MINUTE,
  skip: (req) => SAFE_METHODS.has(req.method),
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { message: 'Too many write requests, please slow down.' }
});
