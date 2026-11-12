import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { register, login, logout, me } from '../controllers/authController.js';

const router = Router();

// register/login run before a session (and CSRF token) exists, so they are
// CSRF-exempt — but rate-limited to blunt credential-stuffing and floods.
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
// logout is a state-changing write with an active session → CSRF-protected.
router.post('/logout', csrfProtection, logout);
router.get('/me', requireAuth, me);

export default router;
