
import { Router } from 'express';
import {
  register,
  login,
  logout,
  me
} from '../controllers/authController.js';

import { requireAuth } from '../middleware/auth.js';

import {
  generateCsrfToken,
  doubleCsrfProtection
} from '../middleware/csrf.js';

const router = Router();

// Public authentication routes (CSRF-exempt)
router.post('/register', register);
router.post('/login', login);

// Restore authenticated session
router.get('/me', requireAuth, me);

// Get CSRF token for the current session
router.get('/csrf-token', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');

  const csrfToken = generateCsrfToken(req, res);

  res.json({ csrfToken });
});

// Logout changes session state and requires CSRF validation
router.post(
  '/logout',
  requireAuth,
  doubleCsrfProtection,
  logout
);

export default router;
