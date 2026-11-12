import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';
import {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser
} from '../controllers/userController.js';

const router = Router();

// Creating a user is now done through POST /api/auth/register.
router.get('/', getAllUsers);
router.get('/:id', getUser);
// Every authenticated state change requires the same CSRF proof as bookings
// and maintenance requests. Login and registration are intentionally exempt
// because a session does not exist yet.
router.patch('/:id', requireAuth, doubleCsrfProtection, updateUser);
router.delete('/:id', requireAuth, doubleCsrfProtection, deleteUser);

export default router;
