import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';
import { maintenanceReadLimiter, maintenanceWriteLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Reading is public; writing requires a logged-in user.
//
// CSRF: write routes are protected by the global doubleCsrfProtection mounted
// in app.js before this router.
// DoS: every route is rate-limited per client. The limiter runs first so a
// flood is rejected with 429 before any auth check or database query.
router.get('/', maintenanceReadLimiter, getAllRequests);
router.get('/:id', maintenanceReadLimiter, getRequest);
router.post('/', maintenanceWriteLimiter, requireAuth, createRequest);
router.patch('/:id', maintenanceWriteLimiter, requireAuth, updateRequest);
router.delete('/:id', maintenanceWriteLimiter, requireAuth, deleteRequest);

export default router;
