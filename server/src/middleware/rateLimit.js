import { rateLimit } from 'express-rate-limit';

// Throttle the maintenance feature so a single client can't flood it (DoS).
// 20 requests per minute per IP is plenty for a person using the UI, but a
// script or a malicious page firing hundreds of requests gets 429 quickly.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7', // RateLimit-* headers tell well-behaved clients the budget
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
