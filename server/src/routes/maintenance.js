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
// CSRF — fixed: the write routes below are covered by the app-wide anti-CSRF
//   middleware (middleware/csrf.js, mounted in app.js), so a forged cross-site
//   request without a valid `x-csrf-token` header is rejected with 403.
//
// DoS — fixed: the whole router is mounted behind a rate limiter
//   (middleware/rateLimit.js, applied in app.js), so one client can make at
//   most 20 requests per minute; a flood is refused with 429.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
