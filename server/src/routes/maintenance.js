import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection, generateCsrfToken } from '../middleware/csrf.js';
import { rateLimit } from 'express-rate-limit';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Keep the full maintenance feature bounded per client across reads and writes.
const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many maintenance requests. Please try again later.' }
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
router.get('/csrf-token', requireAuth, (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, csrfProtection, createRequest);
router.patch('/:id', requireAuth, csrfProtection, updateRequest);
router.delete('/:id', requireAuth, csrfProtection, deleteRequest);

export default router;
