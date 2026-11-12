import { rateLimit } from 'express-rate-limit';

// One shared budget for all maintenance reads and writes, including failures.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many maintenance requests. Please try again in a minute.' }
});
