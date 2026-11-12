import rateLimit from 'express-rate-limit';

// Throttle the maintenance feature so one client can't flood it (DoS).
// Each client (by IP) may make at most `limit` requests per window; anything
// beyond that is refused with 429 Too Many Requests *before* it reaches the
// database. 30/minute is plenty for a resident using the page normally (load
// the list, file or delete a few requests) but cuts a flood off almost at once.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7', // RateLimit-* headers so clients can back off
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

// Minting CSRF tokens is cheap but still per-request work, so cap it too.
export const csrfTokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
