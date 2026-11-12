import rateLimit from 'express-rate-limit';

// DoS protection: cap how many requests one client (keyed by IP) can make to
// the maintenance feature in a time window. Once a client goes over the cap,
// it gets 429 Too Many Requests and the request never reaches the database.
// 30 requests per minute is plenty for a person using the UI but stops a flood.
export const maintenanceLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 30,
  standardHeaders: 'draft-7', // send RateLimit-* headers so clients can back off
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
