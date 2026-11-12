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
// Hardened on two fronts:
//   1. CSRF — every state-changing request must carry a valid anti-CSRF token
//      in the `x-csrf-token` header (enforced app-wide in app.js by
//      `doubleCsrfProtection`, before this router runs). A forged cross-site
//      request only has the auth cookie, so it is refused with 403.
//   2. DoS — every route here is rate-limited per client (mounted in app.js,
//      ahead of the CSRF check), and writes get a stricter extra limit, so a
//      flood is refused with 429.

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
