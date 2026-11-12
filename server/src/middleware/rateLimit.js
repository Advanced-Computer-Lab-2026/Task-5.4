import rateLimit from 'express-rate-limit';

// Throttle the maintenance feature: 30 requests / minute / client.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
