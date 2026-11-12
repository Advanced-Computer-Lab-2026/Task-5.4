import rateLimit from 'express-rate-limit';

// Caps how often one client (keyed by IP) may call the maintenance feature.
// A page load costs one or two requests, so 30 a minute is generous for a real
// user while a flood is refused with 429 instead of reaching the database.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7', // RateLimit-* headers so clients know when to retry
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
