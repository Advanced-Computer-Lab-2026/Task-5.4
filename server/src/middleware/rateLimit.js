import rateLimit from 'express-rate-limit';

export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1-minute window
  limit: 20,                  // max 60 requests per IP per window (use `max` on v6)
  standardHeaders: 'draft-7', // sends RateLimit headers so clients know their budget
  legacyHeaders: false,       // drop the old X-RateLimit-* headers
  message: { message: 'Too many requests, please try again later.' },
});