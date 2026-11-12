import { Router } from 'express';
import { logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Login/register are mounted before global CSRF protection in app.js.
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
