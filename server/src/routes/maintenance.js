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

// Rate-limit the whole feature so one client cannot flood it (DoS).
router.use(maintenanceLimiter);

// Reading is public; writing requires a logged-in user.
//
// The writes are additionally protected by the global CSRF middleware mounted in
// app.js (double-submit token), so a forged cross-site request lacking the
// `x-csrf-token` header is refused with 403. Safe GET requests stay exempt.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
