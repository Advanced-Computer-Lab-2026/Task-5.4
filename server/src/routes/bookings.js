import { Router } from 'express';
import { authenticatedWrite } from '../middleware/csrf.js';
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
router.post('/', authenticatedWrite, createBooking);
router.patch('/:id', authenticatedWrite, updateBooking);
router.delete('/:id', authenticatedWrite, deleteBooking);

export default router;
