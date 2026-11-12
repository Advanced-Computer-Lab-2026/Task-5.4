import { rateLimit } from 'express-rate-limit';

// Throttle the maintenance feature per client (keyed by IP) so a single client
// — or a lured victim's browser — cannot flood it. Once the limit is exceeded
// within the window, further requests get 429 Too Many Requests without ever
// reaching the controller or the database.
//
// 30 requests/minute is plenty for a person using the Maintenance page (one
// list load per visit plus one per submitted/deleted request), but cuts a
// scripted flood off almost immediately.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7', // RateLimit-* headers so clients can back off
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
