
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import {
  getAllBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking
} from '../controllers/bookingController.js';

const router = Router();

// Reading is public; writing requires authentication and CSRF protection.
router.get('/', getAllBookings);
router.get('/:id', getBooking);
router.post('/', requireAuth, doubleCsrfProtection, createBooking);
router.patch('/:id', requireAuth, doubleCsrfProtection, updateBooking);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteBooking);

export default router;
