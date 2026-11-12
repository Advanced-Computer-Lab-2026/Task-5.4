import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Reading is public; writing requires a session and its CSRF token.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, requireCsrf, createRequest);
router.patch('/:id', requireAuth, requireCsrf, updateRequest);
router.delete('/:id', requireAuth, requireCsrf, deleteRequest);

export default router;
