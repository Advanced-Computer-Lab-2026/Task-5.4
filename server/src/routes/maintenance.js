import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Reading is public; writing requires a logged-in user.
//
// Hardened on two fronts:
//   1. CSRF — every write must carry a valid anti-CSRF token in the
//      `x-csrf-token` header (enforced app-wide in app.js via csrf-csrf).
//   2. DoS — every maintenance endpoint is rate-limited per client; a flood
//      is refused with 429 Too Many Requests.

const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,           // 30 requests per client
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
});

// Apply before the maintenance route handlers
router.use(maintenanceLimiter);
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
