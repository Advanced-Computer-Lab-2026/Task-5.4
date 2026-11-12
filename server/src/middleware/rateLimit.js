import rateLimit from 'express-rate-limit';

// One client should not be able to hammer an endpoint into exhaustion.
// `express-rate-limit` returns 429 Too Many Requests once a client exceeds
// the limit inside the window. Keyed by IP (all of supertest/the flood come
// from one IP, exactly like the attacker page's flood from one browser).

// The maintenance feature (list + writes) — the endpoint the DoS flood hit.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30, // generous for real use; a flood of 40+ hits the ceiling
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests — please slow down.' }
});

// Bookings and user-profile writes get the same treatment.
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests — please slow down.' }
});

// Auth routes: also blunts credential-stuffing / registration floods.
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts — try again in a minute.' }
});
