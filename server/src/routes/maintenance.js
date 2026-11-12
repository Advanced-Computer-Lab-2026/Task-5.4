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
import { doubleCsrfProtection } from '../middleware/csrf.js';

const router = Router();

// Rate limiter: 25 requests per 15 minutes window
export const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

// 1. Mount rate limiting on ALL maintenance routes first
router.use(maintenanceLimiter);

// 2. Public read routes
router.get('/', getAllRequests);
router.get('/:id', getRequest);

// 3. Protected write routes (Auth + CSRF)
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;