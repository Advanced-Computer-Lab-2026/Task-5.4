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

// Reading is public; writing requires a logged-in user.
//
// Hardened on two fronts:
//   1. CSRF — every state-changing request must carry a valid anti-CSRF token
//      (enforced app-wide by doubleCsrfProtection in app.js), so a forged
//      cross-site request that only has the auth cookie is rejected with 403.
//   2. DoS — every route is rate-limited per client, and writes have a stricter
//      limit; a flood is answered with 429 Too Many Requests.
router.use(maintenanceLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', maintenanceWriteLimiter, requireAuth, createRequest);
router.patch('/:id', maintenanceWriteLimiter, requireAuth, updateRequest);
router.delete('/:id', maintenanceWriteLimiter, requireAuth, deleteRequest);

export default router;
