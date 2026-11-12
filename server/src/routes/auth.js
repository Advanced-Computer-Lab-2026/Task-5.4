import { Router } from 'express';
import { register, login, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { doubleCsrfProtection } from '../middleware/csrf.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
// Logout changes state too, so it needs a token (prevents forced logout).
// register/login stay unprotected: no session exists yet.
router.post('/logout', doubleCsrfProtection, logout);
router.get('/me', requireAuth, me);

export default router;
