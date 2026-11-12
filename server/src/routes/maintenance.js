import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { maintenanceLimiter, maintenanceWriteLimiter } from '../middleware/rateLimit.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// DoS: every maintenance route is rate-limited per client (429 when exceeded).
router.use(maintenanceLimiter);

// Reading is public; writing requires a logged-in user.
// CSRF: the write routes are additionally protected by the global
// doubleCsrfProtection middleware mounted in app.js — a write without a valid
// x-csrf-token header is rejected with 403 before it ever reaches here.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', maintenanceWriteLimiter, requireAuth, createRequest);
router.patch('/:id', maintenanceWriteLimiter, requireAuth, updateRequest);
router.delete('/:id', maintenanceWriteLimiter, requireAuth, deleteRequest);

export default router;
