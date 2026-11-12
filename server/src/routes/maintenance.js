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
// Hardened in app.js (applied before these routes run):
//   1. CSRF — every write must carry a valid, session-bound x-csrf-token
//      header (middleware/csrf.js); forged cross-site requests get 403.
//   2. DoS — every /api/maintenance request is rate-limited per client
//      (middleware/rateLimit.js); a flood gets 429.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
