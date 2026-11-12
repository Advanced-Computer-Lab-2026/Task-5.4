
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

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

// Limit each IP to 20 maintenance requests per 15 minutes.
const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many maintenance requests. Please try again later.'
  }
});

// Apply rate limiting to every maintenance endpoint.
router.use(maintenanceLimiter);

// Public read operations (GET is exempt from CSRF protection).
router.get('/', getAllRequests);
router.get('/:id', getRequest);

// Authenticated write operations protected against CSRF.
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;
