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
// Hardened in app.js:
//   1. CSRF — every write must carry a valid x-csrf-token header (csrf-csrf,
//      see middleware/csrf.js), so a forged cross-site request gets 403.
//   2. DoS — this router is mounted behind express-rate-limit (see
//      middleware/rateLimit.js), so a flood from one client gets 429.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
