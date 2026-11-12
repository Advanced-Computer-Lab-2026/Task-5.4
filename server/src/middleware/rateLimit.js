import { rateLimit } from 'express-rate-limit';

// Throttle the maintenance feature so a single client cannot flood it (DoS).
//
// Keyed by client IP (express-rate-limit's default), it caps how many requests
// one client may make in the window and answers 429 Too Many Requests once the
// cap is exceeded — so a flood is refused instead of competing for the DB.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 20, // per client, per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // CORS preflights must not consume a client's quota.
  skip: (req) => req.method === 'OPTIONS',
  message: { message: 'Too many requests, please try again later.' }
});
