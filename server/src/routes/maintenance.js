import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import { maintenanceRateLimit } from '../middleware/maintenanceRateLimit.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Reading is public. The whole feature is rate-limited, and authenticated
// writes additionally require a CSRF token before they reach the controller.
router.use(maintenanceRateLimit);
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;
