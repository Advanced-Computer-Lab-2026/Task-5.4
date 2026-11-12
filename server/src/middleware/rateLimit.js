import rateLimit from 'express-rate-limit';

// Throttle the maintenance feature so one client cannot flood it (DoS).
// Each client (by IP) gets a fixed budget per window; once it's spent, the
// server answers 429 Too Many Requests without touching the database.

// Reads are public and cheap-ish, but each one still runs a DB query.
// 20 per minute is plenty for a person using the page, and far too few for a flood.
export const maintenanceReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7', // send RateLimit-* headers so clients know their budget
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

// Writes change data in the user's name, so they get a tighter budget.
export const maintenanceWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many maintenance changes, please try again later.' }
});
