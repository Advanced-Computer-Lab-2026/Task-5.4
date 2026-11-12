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
// Hardened in app.js against the two attacks in Flow.md:
//   1. CSRF — the global csrfProtection middleware rejects (403) any POST,
//      PATCH or DELETE that lacks a valid, session-bound `x-csrf-token` header,
//      so the auth cookie alone is no longer enough to write data.
//   2. DoS — maintenanceLimiter caps how often one client may call these
//      routes and answers 429 once the limit is exceeded.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
