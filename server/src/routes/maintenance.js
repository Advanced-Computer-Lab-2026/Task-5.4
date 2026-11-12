import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import { maintenanceLimiter } from '../middleware/rateLimit.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// DoS fix: throttle every maintenance request (reads included — the flood in
// the attack hits the public GET list). One client over the limit gets 429.
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
// Reads are "safe" (no state change) — no CSRF token required.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
// Writes are state-changing — they require BOTH a valid session (requireAuth)
// AND a valid anti-CSRF token (doubleCsrfProtection). The forged cross-site
// request carries the cookie but no token, so it is rejected with 403.
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;
