import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Rate-limit the maintenance endpoints so a single client cannot flood them (DoS).
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

router.use(maintenanceLimiter);

// Reading is public; writing requires a logged-in user and a valid CSRF token.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, csrfProtection, createRequest);
router.patch('/:id', requireAuth, csrfProtection, updateRequest);
router.delete('/:id', requireAuth, csrfProtection, deleteRequest);

export default router;
