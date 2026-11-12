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
// Two protections are applied in app.js before this router is reached:
//   - maintenanceLimiter caps every client at 30 requests/minute (DoS).
//   - doubleCsrfProtection rejects any write without a valid CSRF token (CSRF).
// Writes additionally get the tighter maintenanceWriteLimiter below.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', maintenanceWriteLimiter, requireAuth, createRequest);
router.patch('/:id', maintenanceWriteLimiter, requireAuth, updateRequest);
router.delete('/:id', maintenanceWriteLimiter, requireAuth, deleteRequest);

export default router;
