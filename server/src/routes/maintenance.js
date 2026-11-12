
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

// DoS protection: maximum 20 requests per minute
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please try again later.'
  }
});

// Apply rate limiting to every maintenance endpoint
router.use(maintenanceLimiter);

// GET requests do not need CSRF tokens
router.get('/', getAllRequests);
router.get('/:id', getRequest);

// POST requires authentication and a valid CSRF token
router.post(
  '/',
  requireAuth,
  doubleCsrfProtection,
  createRequest
);

// PATCH requires authentication and a valid CSRF token
router.patch(
  '/:id',
  requireAuth,
  doubleCsrfProtection,
  updateRequest
);

// DELETE requires authentication and a valid CSRF token
router.delete(
  '/:id',
  requireAuth,
  doubleCsrfProtection,
  deleteRequest
);

export default router;
