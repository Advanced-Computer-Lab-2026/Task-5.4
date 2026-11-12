import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { maintenanceLimiter } from '../middleware/rateLimit.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Reading is public; writing requires a logged-in user AND a valid CSRF token.
//   - DoS: every maintenance route is rate-limited (429 when exceeded).
//   - CSRF: state-changing routes require the x-csrf-token header (403 if
//     missing/invalid). Safe GETs are exempt.
router.use(maintenanceLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, csrfProtection, createRequest);
router.patch('/:id', requireAuth, csrfProtection, updateRequest);
router.delete('/:id', requireAuth, csrfProtection, deleteRequest);

export default router;
