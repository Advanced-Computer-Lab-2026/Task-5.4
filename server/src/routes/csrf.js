import { Router } from 'express';
import { generateToken } from '../middleware/csrf.js';

// Issues a fresh, per-session anti-CSRF token and stores its keyed hash in a
// cookie (the double-submit-cookie pattern). The raw token is returned in the
// JSON body so our own SPA can echo it back in the `x-csrf-token` header on
// every state-changing request. An attacker's site cannot read this response
// (cross-origin reads are blocked) and cannot set request headers from a bare
// HTML form, so the token is a proof of intent the attacker cannot forge.
const router = Router();

router.get('/csrf-token', (req, res) => {
  const csrfToken = generateToken(req, res);
  res.json({ csrfToken });
});

export default router;
