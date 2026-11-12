
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
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

const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please try again later.'
  }
});

router.use(maintenanceLimiter);

// Reading is public; writing requires authentication and CSRF protection.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;
