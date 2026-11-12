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

// Shared across the whole maintenance feature so switching paths or methods
// does not provide a fresh request budget.
const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many maintenance requests. Please try again later.' }
});
router.use(maintenanceLimiter);

// Reading is public; writing requires a logged-in user.
//
// Unsafe requests are checked by the CSRF middleware in app.js; requests here
// share a per-client budget across reads and writes.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;
