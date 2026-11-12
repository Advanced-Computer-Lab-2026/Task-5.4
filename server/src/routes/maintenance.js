import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { maintenanceWriteLimiter } from '../middleware/rateLimit.js';
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
//   1. CSRF — app.js requires a valid anti-CSRF token (x-csrf-token header)
//      on every state-changing request, so the auth cookie alone is no longer
//      enough to file, edit or delete a request.
//   2. DoS — app.js rate-limits the whole /api/maintenance feature per client,
//      and writes get a tighter limit below.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', maintenanceWriteLimiter, requireAuth, createRequest);
router.patch('/:id', maintenanceWriteLimiter, requireAuth, updateRequest);
router.delete('/:id', maintenanceWriteLimiter, requireAuth, deleteRequest);

export default router;
