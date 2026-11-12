import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';
import { requireCsrf } from '../middleware/csrf.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many maintenance requests. Try again in a minute.'
  }
});

router.use(maintenanceLimiter);
// Reading is public; writing requires a logged-in user.
//
// VULNERABLE on two fronts:
//   1. CSRF — the write routes trust the auth cookie alone. There is no
//      anti-CSRF token, so any website the victim visits can forge a
//      state-changing request in the victim's name (the browser attaches the
//      cookie automatically).
//   2. DoS — there is no rate limiting anywhere, so the public list endpoint
//      (and the writes) can be flooded with unlimited requests to exhaust the
//      server.
router.get('/', getAllRequests);
router.get('/:id', getRequest);

router.post('/', requireAuth, requireCsrf, createRequest);
router.patch('/:id', requireAuth, requireCsrf, updateRequest);
router.delete('/:id', requireAuth, requireCsrf, deleteRequest);

export default router;
