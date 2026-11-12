import { rateLimit } from 'express-rate-limit';

// Per-client throttling for the maintenance feature. Each limiter counts
// requests per client IP in a fixed time window; once a client goes over the
// limit, every further request in that window is rejected with
// 429 Too Many Requests before it reaches auth, Joi or MongoDB, so a flood
// costs the server almost nothing.
//
// The counters live in memory (the default store). That is fine for a single
// Node process; with several instances behind a load balancer, swap in a shared
// store (e.g. Redis) so the limit is enforced across all of them. If the app is
// ever deployed behind a reverse proxy, also set `app.set('trust proxy', 1)` so
// req.ip is the real client and not the proxy (otherwise everyone shares one
// bucket).

const common = {
  standardHeaders: 'draft-7', // send a combined `RateLimit` header + `Retry-After`
  legacyHeaders: false        // drop the old X-RateLimit-* headers
};

// Public list/detail reads. No login is needed, so this is the easiest thing
// for an attacker to hammer, and each hit runs a populate()+sort() query.
// 30/min is far above what a person clicking around the UI produces.
export const maintenanceReadLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 30,
  message: { message: 'Too many requests, please try again later.' }
});

// Create/update/delete. These write to the database, so they get a tighter
// budget than reads.
export const maintenanceWriteLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 10,
  message: { message: 'Too many changes, please slow down and try again later.' }
});
