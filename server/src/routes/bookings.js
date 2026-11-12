import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import {
  getAllBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking
} from '../controllers/bookingController.js';

const router = Router();

// Reading is public; writing requires a logged-in user.
router.get('/', getAllBookings);
router.get('/:id', getBooking);
router.post('/', requireAuth, requireCsrf, createBooking);
router.patch('/:id', requireAuth, requireCsrf, updateBooking);
router.delete('/:id', requireAuth, requireCsrf, deleteBooking);

export default router;
