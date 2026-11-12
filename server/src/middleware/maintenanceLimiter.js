import { rateLimit } from 'express-rate-limit';

// One shared budget across list, detail, create, update and delete requests.
// The default key uses the actual peer IP (with IPv6 subnet normalization).
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many maintenance requests. Please try again in a minute.' }
});
