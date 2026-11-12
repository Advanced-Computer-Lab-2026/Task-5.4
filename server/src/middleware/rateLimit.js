import rateLimit from 'express-rate-limit';

// Throttle the maintenance feature so one client cannot flood it (DoS).
// Once a client exceeds the limit within the window, it gets 429 Too Many Requests.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,           // max requests per client (IP) per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
