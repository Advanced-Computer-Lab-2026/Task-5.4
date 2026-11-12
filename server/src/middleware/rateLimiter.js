import rateLimit from 'express-rate-limit';

// Limit client requests to prevent DoS floods while allowing legitimate use.
// 40 rapid requests in tests will trigger 429 after 20 requests.
export const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
