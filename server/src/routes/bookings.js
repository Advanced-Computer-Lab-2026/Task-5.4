import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
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
router.post('/', requireAuth, csrfProtection, createBooking);
router.patch('/:id', requireAuth, csrfProtection, updateBooking);
router.delete('/:id', requireAuth, csrfProtection, deleteBooking);

export default router;
