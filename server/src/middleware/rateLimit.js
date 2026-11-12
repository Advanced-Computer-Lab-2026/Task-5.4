import rateLimit from 'express-rate-limit';

const WINDOW_MS = 60 * 1000;

function limiter(limit, message) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7', // RateLimit-* headers tell clients when to retry
    legacyHeaders: false,
    message: { message }
  });
}

// Every maintenance request, per client IP: 30 per minute. Enough for normal
// browsing of the page, far too few for a flood.
export const maintenanceLimiter = limiter(30, 'Too many requests, please try again later.');

// Writes are rarer and more expensive, so they get a tighter budget on top.
export const maintenanceWriteLimiter = limiter(10, 'Too many changes, please slow down.');
