import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';
import { maintenanceLimiter } from '../middleware/security.js';

const router = Router();

// Reading is public; writing requires a logged-in user.
//
// Hardened on two fronts:
//   1. CSRF — writes are checked by the global csrf-csrf middleware in app.js
//      (a valid x-csrf-token header is required, otherwise 403).
//   2. DoS — every maintenance route is rate-limited per client; a flood gets
//      429 Too Many Requests instead of hitting the database.
router.use(maintenanceLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
