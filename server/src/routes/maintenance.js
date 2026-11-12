import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { maintenanceLimiter } from '../middleware/rateLimit.js';
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
// SECURED on both fronts:
//   1. CSRF — every state-changing route now demands a valid anti-CSRF token
//      (`csrf-csrf`, double-submit cookie). A forged cross-site request may
//      carry the auth cookie, but it can never carry the secret token, so it
//      is refused with 403.
//   2. DoS — the whole feature is rate-limited; a flood is throttled with 429.
router.use(maintenanceLimiter);
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, csrfProtection, createRequest);
router.patch('/:id', requireAuth, csrfProtection, updateRequest);
router.delete('/:id', requireAuth, csrfProtection, deleteRequest);

export default router;
