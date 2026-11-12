import { rateLimit } from 'express-rate-limit';

export const maintenanceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many maintenance requests. Please try again in a minute.' }
});
