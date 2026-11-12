import { Router } from 'express';
import { register, login, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
// login/register run before a session exists, so they are exempt from CSRF.
// Logout is state-changing and requires the CSRF token.
router.post('/logout', csrfProtection, logout);
router.get('/me', requireAuth, me);

export default router;
