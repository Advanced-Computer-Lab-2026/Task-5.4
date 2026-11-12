import { issueCsrfToken, requireCsrf } from '../middleware/csrf.js';
import { Router } from 'express';
import { register, login, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.get('/csrf-token', requireAuth, issueCsrfToken);
router.post('/logout', requireAuth, requireCsrf, logout);

export default router;
