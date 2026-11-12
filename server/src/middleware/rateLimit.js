import { rateLimit } from 'express-rate-limit';

// Rate limiting for the maintenance feature (DoS protection).
//
// Without a limit, every request runs a database query, so one client (or a page
// that makes many lured visitors fire requests) can flood the API until legitimate
// users time out. These limiters count requests per client IP within a time
// window and answer 429 Too Many Requests once the limit is exceeded.

const tooMany = (req, res, next, options) =>
  res.status(options.statusCode).json({
    message: 'Too many requests, please try again later.'
  });

// Every maintenance route (reads + writes): 30 requests per minute per client.
// Plenty for a resident browsing the page, far below what a flood needs.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7', // RateLimit-* headers so clients can back off
  legacyHeaders: false,
  handler: tooMany
});

// Writes are more expensive and rarer: 10 per 15 minutes per client.
export const maintenanceWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany
});
