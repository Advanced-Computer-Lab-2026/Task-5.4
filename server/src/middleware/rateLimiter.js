import { rateLimit } from 'express-rate-limit';

export const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Allow up to 25 requests per windowMs before rate limiting
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

