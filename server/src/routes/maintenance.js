import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrfToken } from '../middleware/csrf.js';
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
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many maintenance requests. Please try again later.' },
  statusCode: 429,
  keyGenerator: (req) => req.ip || 'unknown-ip'
});

router.use(maintenanceLimiter);
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, requireCsrfToken, createRequest);
router.patch('/:id', requireAuth, requireCsrfToken, updateRequest);
router.delete('/:id', requireAuth, requireCsrfToken, deleteRequest);

export default router;
