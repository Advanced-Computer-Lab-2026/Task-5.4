import rateLimit from 'express-rate-limit';

// Throttle the maintenance feature: at most 30 requests per client per minute.
// Beyond that the client gets 429 Too Many Requests instead of hitting the DB.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
