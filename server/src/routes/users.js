import { Router } from 'express';
import { authenticatedWrite } from '../middleware/csrf.js';
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
router.patch('/:id', authenticatedWrite, updateUser);
router.delete('/:id', authenticatedWrite, deleteUser);

export default router;
