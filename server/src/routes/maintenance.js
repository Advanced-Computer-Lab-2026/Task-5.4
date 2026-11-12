import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// DoS protection: one client may only make a limited number of maintenance
// calls per window; beyond that the server answers 429 Too Many Requests.
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
router.use(maintenanceLimiter);

// Reading is public; writing requires a logged-in user.
// CSRF protection for POST/PATCH/DELETE is applied globally in app.js
// (doubleCsrfProtection), so a forged cross-site write gets 403.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;