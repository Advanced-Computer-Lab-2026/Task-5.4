import rateLimit from 'express-rate-limit';

// At most 30 requests per client per minute across the maintenance feature.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
