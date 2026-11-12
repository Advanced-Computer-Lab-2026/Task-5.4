
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';

import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// DoS protection: maximum 30 requests per 15 minutes
const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many maintenance requests. Please try again later.'
  }
});

// Apply rate limiting to all maintenance routes
router.use(maintenanceLimiter);

// GET requests
router.get('/', getAllRequests);
router.get('/:id', getRequest);

// Protected requests
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
