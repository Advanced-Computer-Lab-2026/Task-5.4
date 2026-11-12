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
// CSRF: the write routes below (POST/PATCH/DELETE) are covered by the global
// csrfProtection middleware in app.js. They need a valid x-csrf-token header on
// top of the auth cookie, so a forged cross-site request gets a 403.
//
// DoS: every route here is rate-limited per client by maintenanceLimiter and
// maintenanceWriteLimiter (middleware/rateLimit.js), mounted in app.js. A
// flood gets a 429 before any database work runs.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
