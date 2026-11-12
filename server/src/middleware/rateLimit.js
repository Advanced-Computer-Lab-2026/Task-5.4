import { rateLimit } from 'express-rate-limit';

// Rate limiting (DoS protection) with express-rate-limit. Each limiter counts
// requests per client IP in a fixed time window and answers
// `429 Too Many Requests` once the client goes over the limit. The limits are
// generous enough for a person clicking around the app, but far below what a
// flooding script (or the attacker page's 300-request burst) sends.

const ONE_MINUTE = 60 * 1000;

function limiter({ windowMs, limit, message, ...rest }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8', // RateLimit / RateLimit-Policy response headers
    legacyHeaders: false, // no X-RateLimit-* headers
    message: { message },
    ...rest
  });
}

// Baseline for the whole API, so no endpoint can be flooded without limit.
export const apiLimiter = limiter({
  windowMs: ONE_MINUTE,
  limit: 120,
  message: 'Too many requests, please try again later.'
});

// The maintenance feature: every call hits the database, so it gets a
// tighter budget. A normal visit makes a handful of requests per minute.
export const maintenanceLimiter = limiter({
  windowMs: ONE_MINUTE,
  limit: 30,
  message: 'Too many maintenance requests, please slow down and try again in a minute.'
});

// Login/register run an expensive bcrypt hash and are the target of
// password-guessing. Only failed attempts count, so legitimate users who log in
// successfully are never locked out.
export const authLimiter = limiter({
  windowMs: 15 * ONE_MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.'
});
