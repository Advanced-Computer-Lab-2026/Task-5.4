import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

router.use(maintenanceLimiter);
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
