import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
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
// Hardened on two fronts:
//   1. CSRF — the write routes no longer trust the auth cookie alone: the
//      app-wide csrfProtection middleware (app.js) rejects any POST/PATCH/DELETE
//      without a valid, session-bound x-csrf-token header with 403.
//   2. DoS — every maintenance route is rate-limited per client; a flood is
//      refused with 429 before it reaches the controller or the database.
router.use(maintenanceLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
