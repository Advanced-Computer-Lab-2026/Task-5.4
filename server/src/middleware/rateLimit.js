import { rateLimit } from 'express-rate-limit';

// DoS protection for the maintenance feature: each client (by IP) may make at
// most 20 requests per minute to /api/maintenance. Request number 21 inside the
// same window is refused with 429 Too Many Requests.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 20,
  standardHeaders: 'draft-8', // send the RateLimit headers
  legacyHeaders: false, // no X-RateLimit-* headers
  message: { message: 'Too many requests, please try again later.' }
});
