import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { maintenanceReadLimiter, maintenanceWriteLimiter } from '../middleware/rateLimit.js';
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
// Fixed on two fronts:
//   1. CSRF — every state-changing request must carry a valid anti-CSRF token
//      (checked globally in app.js by the csrf-csrf middleware), so a forged
//      cross-site request that only has the auth cookie is rejected with 403.
//   2. DoS — every route is rate-limited per client, so a flood gets 429
//      instead of reaching the database.
router.use(maintenanceReadLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', maintenanceWriteLimiter, requireAuth, createRequest);
router.patch('/:id', maintenanceWriteLimiter, requireAuth, updateRequest);
router.delete('/:id', maintenanceWriteLimiter, requireAuth, deleteRequest);

export default router;
