import { Router } from 'express';
import { register, login, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authenticatedWrite } from '../middleware/csrf.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticatedWrite, logout);
router.get('/me', requireAuth, me);

export default router;
