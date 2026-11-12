import { rateLimit } from 'express-rate-limit';

// Rate limiting for the maintenance feature (DoS protection).
//
// Every maintenance call does real work (a MongoDB query, or a write), so an
// unthrottled client can flood it and starve everyone else. These limiters count
// requests per client (keyed by IP) in a fixed time window. Once a client goes
// over its budget, it gets a 429 Too Many Requests until the window resets.
// The rejection happens before any controller or database work runs, so
// rejected requests cost almost nothing.
//
// Notes:
//   - The key is the client IP (express-rate-limit's default). Behind a reverse
//     proxy or load balancer, set `app.set('trust proxy', 1)` (or the right hop
//     count). Otherwise every user shares the proxy's IP and one bucket.
//   - The default store is in-memory, so it's per process. With several server
//     instances, use a shared store (e.g. rate-limit-redis) so the limit holds
//     across all of them.
//   - A per-client limit stops a single flooder (like the attacker page running
//     in one victim's browser). It doesn't stop a large distributed (DDoS)
//     attack. That's handled upstream (CDN/WAF, network-level filtering).

// Same JSON shape as the app's other errors ({ message }), so the client can
// show it like any other failure.
function tooManyRequests(req, res, next, options) {
  res.status(options.statusCode).json({
    message: 'Too many requests, please slow down and try again later.'
  });
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Overall budget for one client across the maintenance API (reads and writes).
// 30 requests a minute is plenty for a person using the page (one list load per
// visit, plus a few actions). A flood script hits the limit within seconds.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: 'draft-7', // RateLimit / RateLimit-Policy headers tell clients their budget
  legacyHeaders: false,       // drop the old X-RateLimit-* headers
  handler: tooManyRequests
});

// Tighter budget for state-changing calls (file, edit, delete). They cost more
// (validation plus a DB write) and add data, so a write flood would also fill
// the collection. Nobody legitimately files more than a handful of maintenance
// requests in 15 minutes.
export const maintenanceWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => SAFE_METHODS.has(req.method), // only count writes
  handler: tooManyRequests
});
