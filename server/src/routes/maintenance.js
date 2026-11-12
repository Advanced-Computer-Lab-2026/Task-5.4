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
// Protections (applied in app.js, before this router runs):
//   1. DoS  — maintenanceLimiter caps how many requests one client may make
//      per window and answers a flood with 429 Too Many Requests.
//   2. CSRF — csrfProtection requires a valid x-csrf-token header on every
//      state-changing request (POST/PATCH/DELETE). A forged cross-site request
//      only carries the cookies, not the header, so it is refused with 403.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
