import { rateLimit } from 'express-rate-limit';

// DoS protection: cap how often one client (by IP) can hit the maintenance
// feature. Every call runs a database query, so without a cap a single page
// (or a crowd of lured browsers) can flood the API and starve real users.
// Once over the limit, the request is refused with 429 before any DB work.
const tooMany = (req, res) =>
  res.status(429).json({ message: 'Too many requests, please try again later.' });

// All maintenance traffic: 30 requests per minute per client is plenty for a
// person using the UI, but stops a flood after the first few dozen requests.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany,
});

// Writes are rarer and more expensive (they create/modify data), so they get a
// tighter extra budget: 10 per minute per client.
export const maintenanceWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  handler: tooMany,
});
