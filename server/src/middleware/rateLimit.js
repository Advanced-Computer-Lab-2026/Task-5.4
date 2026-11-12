import rateLimit from 'express-rate-limit';

// Caps how often one client (by IP) may hit the maintenance feature. Excess
// requests get 429 Too Many Requests without ever reaching the database.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,           // 30 requests per client per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
