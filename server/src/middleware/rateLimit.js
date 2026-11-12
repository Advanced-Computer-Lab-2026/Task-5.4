import { rateLimit } from 'express-rate-limit';

// DoS protection: cap how many requests one client (keyed by IP) may make in a
// time window. Requests over the limit are refused with 429 Too Many Requests
// BEFORE they reach the controller, so a flood never touches the database.

// Applies to every maintenance route (reads and writes).
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // 30 requests per IP per minute is plenty for a human using the UI
  standardHeaders: 'draft-8', // send RateLimit-* headers so clients can back off
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

// Stricter cap for state-changing requests (filing/editing/deleting).
export const maintenanceWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many write requests, please slow down.' }
});
