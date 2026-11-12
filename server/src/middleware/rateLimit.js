import rateLimit from 'express-rate-limit';

// Throttle the maintenance feature so one client cannot flood it.
// 30 requests / minute / IP is well above what a person clicking through the
// UI produces, but stops a scripted flood after the first few dozen requests.
export const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
