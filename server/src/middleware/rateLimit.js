import rateLimit from 'express-rate-limit';

// Throttle the maintenance feature: one client (keyed by IP) may make at most
// 30 requests per minute. Anything beyond that is refused with
// 429 Too Many Requests before it reaches the controller or the database.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
