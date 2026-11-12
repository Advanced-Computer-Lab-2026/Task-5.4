import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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

// --- DoS protection ---
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // maximum 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all maintenance endpoints
router.use(maintenanceLimiter);

// --- Maintenance routes ---
// GET routes are read-only and exempt from CSRF
router.get('/', getAllRequests);
router.get('/:id', getRequest);

// State-changing routes require both authentication and CSRF token validation
router.post('/', requireAuth, doubleCsrfProtection, createRequest);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateRequest);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteRequest);

export default router;
