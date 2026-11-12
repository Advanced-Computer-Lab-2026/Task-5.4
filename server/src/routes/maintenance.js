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

// DoS protection: each client (by IP) may make at most 30 requests per minute
// to the maintenance feature. Excess requests get 429 Too Many Requests and are
// refused before reaching the controller, so a flood never hits the database.
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
router.use(maintenanceLimiter);

// Reading is public; writing requires a logged-in user.
// CSRF protection for the write routes is applied globally in app.js.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', requireAuth, createRequest);
router.patch('/:id', requireAuth, updateRequest);
router.delete('/:id', requireAuth, deleteRequest);

export default router;