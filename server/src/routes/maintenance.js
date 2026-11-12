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
// CSRF protection (app.js) and rate limiting (maintenanceLimiter) are applied upstream.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
