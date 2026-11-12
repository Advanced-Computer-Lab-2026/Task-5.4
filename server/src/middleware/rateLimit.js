import { rateLimit } from 'express-rate-limit';

// Throttle the maintenance feature so one client can't flood it (DoS).
// Each client (by IP) gets a fixed budget per window. Requests beyond it get
// 429 Too Many Requests before reaching the controller or the database.

const WINDOW_MS = 60 * 1000; // 1 minute

// Every maintenance route (reads included) counts against this budget. 30
// requests a minute is plenty for someone browsing and filing requests, and far
// below what a flood sends.
export const maintenanceLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

// Writes are more expensive and rarely needed, so they get a tighter budget on
// top of the shared one.
export const maintenanceWriteLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many maintenance changes, please slow down.' }
});
