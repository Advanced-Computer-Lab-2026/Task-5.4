import { rateLimit } from 'express-rate-limit';

// Limit each client IP to a reasonable number of maintenance requests in one
// window. The limiter runs before route controllers, so rejected floods do not
// perform controller work or reach MongoDB.
export const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many maintenance requests, please try again later.'
  }
});
