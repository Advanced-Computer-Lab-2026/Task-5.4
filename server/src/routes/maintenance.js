import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Apply one per-client budget to all maintenance routes before database work.
router.use(rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many maintenance requests. Try again in a minute.' }
}));

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;
