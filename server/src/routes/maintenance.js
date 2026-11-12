import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { maintenanceLimiter, maintenanceWriteLimiter } from '../middleware/rateLimit.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Reading is public. Writing requires a logged-in user.
//
// Hardening:
//   1. CSRF: every state-changing request must carry a valid anti-CSRF token in
//      the x-csrf-token header. The global csrfProtection middleware in app.js
//      enforces this before the request reaches this router.
//   2. DoS: every route is rate-limited per client, and writes get a tighter
//      limit on top of that, so a flood is refused with 429.
router.use(maintenanceLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', maintenanceWriteLimiter, requireAuth, createRequest);
router.patch('/:id', maintenanceWriteLimiter, requireAuth, updateRequest);
router.delete('/:id', maintenanceWriteLimiter, requireAuth, deleteRequest);

export default router;
