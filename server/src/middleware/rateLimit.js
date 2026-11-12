import { rateLimit } from 'express-rate-limit';

// Throttle the maintenance feature so one client cannot flood it (DoS).
// Each client (keyed by IP) may make MAINTENANCE_RATE_LIMIT requests per
// window to /api/maintenance (reads and writes alike); beyond that the server
// answers 429 Too Many Requests without touching the database.
const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT = Number(process.env.MAINTENANCE_RATE_LIMIT) || 30;

export const maintenanceLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: LIMIT,
  standardHeaders: 'draft-7', // RateLimit-* headers so clients can back off
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down and try again shortly.' }
});
