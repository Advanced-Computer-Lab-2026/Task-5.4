import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// DoS fix: throttle the whole maintenance feature per client (by IP).
// Each client may make up to 30 requests per minute; anything beyond that is
// refused with 429 Too Many Requests before it reaches the database.
// 30/min is plenty for a real user clicking around, but stops a flood.
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  limit: 30, // max requests per client per window
  standardHeaders: 'draft-8', // send RateLimit headers so clients know the limit
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

router.use(maintenanceLimiter);

// Reading is public and "safe" (changes nothing), so no CSRF token needed.
router.get('/', getAllRequests);
router.get('/:id', getRequest);

// CSRF fix: every state-changing route requires a valid anti-CSRF token in the
// x-csrf-token header. requireAuth runs first, so a logged-out user still gets
// 401; a logged-in user whose request has no valid token (a forged cross-site
// request) gets 403 and nothing is written.
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;
