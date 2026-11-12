import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import { maintenanceLimiter } from '../middleware/rateLimiter.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

router.use(maintenanceLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);

router.post('/', doubleCsrfProtection, requireAuth, createRequest);
router.patch('/:id', doubleCsrfProtection, requireAuth, updateRequest);
router.delete('/:id', doubleCsrfProtection, requireAuth, deleteRequest);

export default router;