import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Reading is public; writing requires a logged-in user.
//
// CSRF: the write routes still trust the auth cookie alone. There is no
// anti-CSRF token, so any website the victim visits can forge a
// state-changing request in the victim's name (the browser attaches the
// cookie automatically).
//
// DoS: one limiter covers every route on this router, including the public
// GETs. A client that exceeds the quota in the window receives 429.

const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

router.use(maintenanceLimiter);

router.get('/', getAllRequests);
router.get('/:id', getRequest);

router.post(
  '/',
  requireAuth,
  doubleCsrfProtection,
  createRequest
);

router.patch(
  '/:id',
  requireAuth,
  doubleCsrfProtection,
  updateRequest
);

router.delete(
  '/:id',
  requireAuth,
  doubleCsrfProtection,
  deleteRequest
);


export default router;
