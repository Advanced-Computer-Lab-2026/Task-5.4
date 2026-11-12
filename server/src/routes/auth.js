import { Router } from 'express';
import { register, login, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

import { doubleCsrfProtection, generateCsrfToken } from '../middleware/csrf.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', requireAuth, doubleCsrfProtection, logout);
router.get('/csrf-token', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: generateCsrfToken(req, res) });
});
router.get('/me', requireAuth, me);

export default router;
