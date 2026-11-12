import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { maintenanceLimiter } from '../middleware/security.js';
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
//   1. CSRF — every write must carry a valid x-csrf-token header (enforced
//      app-wide by csrfProtection in app.js), so a forged cross-site request
//      is rejected with 403 before it reaches these handlers.
//   2. DoS — the whole feature is rate-limited per client; a flood gets 429.
router.use(maintenanceLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
