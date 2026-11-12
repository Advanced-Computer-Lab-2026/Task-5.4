import rateLimit from 'express-rate-limit';

export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  statusCode: 429,
  message: { message: 'Too many requests, please try again later.' },
});