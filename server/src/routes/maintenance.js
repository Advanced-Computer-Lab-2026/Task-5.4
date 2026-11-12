import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Reading is public and "safe" (no state change), so GETs need no CSRF token.
//
// FIXED on two fronts:
//   1. CSRF: every state-changing route now requires a valid anti-CSRF token
//      in the x-csrf-token header (doubleCsrfProtection). A forged cross-site
//      form can't send that header, so it is rejected with 403.
//   2. DoS: the whole /api/maintenance router is rate-limited in app.js
//      (express-rate-limit), so a flood gets 429 Too Many Requests.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;