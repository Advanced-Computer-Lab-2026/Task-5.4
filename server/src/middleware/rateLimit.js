import rateLimit from 'express-rate-limit';

// Anti-DoS: throttle the maintenance feature so one client cannot flood it.
// Each client (keyed by IP) may make at most 20 requests per minute to
// /api/maintenance; anything beyond that is refused with 429 Too Many Requests
// before it reaches the controller or the database.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 20,           // max requests per client per window
  standardHeaders: 'draft-8', // send RateLimit / RateLimit-Policy headers
  legacyHeaders: false,       // no X-RateLimit-* headers
  message: { message: 'Too many requests, please try again in a minute.' }
});
