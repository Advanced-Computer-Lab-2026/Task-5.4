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
const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many maintenance requests. Please try again later.' }
});
router.use(maintenanceLimiter);

// Reading remains public; writes require both authentication and the
// application-wide CSRF check. All maintenance traffic shares this limiter.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
