import { rateLimit } from 'express-rate-limit';

// Throttle the maintenance feature per client (keyed by IP) so one client
// cannot flood it. Every call hits the database, so unbounded traffic from a
// single source could exhaust the server. Past the limit the client gets
// 429 Too Many Requests until the window resets.
//
// 30 requests per minute is plenty for a human using the page (including
// React StrictMode's double fetch in dev) but stops a scripted flood almost
// immediately.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8', // RateLimit-* headers tell clients when to retry
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

// Writes are more expensive and more abusable than reads, so they get a
// tighter budget on top of the shared one.
export const maintenanceWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many write requests, please slow down.' }
});
