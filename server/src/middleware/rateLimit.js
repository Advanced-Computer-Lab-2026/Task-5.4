import rateLimit from 'express-rate-limit';

// Throttle the maintenance feature per client IP: at most 20 requests per minute,
// then 429 Too Many Requests until the window resets.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.' }
});
