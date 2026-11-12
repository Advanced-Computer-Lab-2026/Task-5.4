import rateLimit from 'express-rate-limit';

// DoS mitigation for the maintenance feature. Without this, one client can
// flood the endpoints (which each do real DB work) and exhaust the server.
// Here we cap how many requests a single client (keyed by IP) may make in a
// short window; once the cap is passed, further requests get 429 Too Many
// Requests instead of hitting the database.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  limit: 20, // max requests per IP per window, then 429
  standardHeaders: true, // send RateLimit-* headers
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
