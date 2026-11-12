import { rateLimit } from 'express-rate-limit';

// Throttle the maintenance feature so one client cannot flood it (DoS).
// Every call does real work (a DB query), so without a cap a single script —
// or the attacker's page running in many visitors' browsers — can exhaust the
// server. Once a client (keyed by IP) exceeds the limit in the window, the
// request is refused with 429 before it ever reaches the database.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,           // requests per client per window — ample for a human
  standardHeaders: 'draft-7', // RateLimit-* headers tell well-behaved clients to back off
  legacyHeaders: false,       // drop the old X-RateLimit-* headers
  message: { message: 'Too many requests, please try again later.' }
});
