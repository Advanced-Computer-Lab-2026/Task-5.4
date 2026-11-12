import { Router } from 'express';
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
// Protections (applied in app.js):
//   1. CSRF — writes require a valid per-session anti-CSRF token in the
//      `x-csrf-token` header (middleware/csrf.js), so a forged cross-site
//      request carrying only the auth cookie is rejected with 403.
//   2. DoS — every route here is rate-limited per client
//      (middleware/rateLimit.js); a flood is refused with 429.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
