import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { requireAuth } from './middleware/auth.js';
import { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError } from './middleware/csrf.js';
import { maintenanceLimiter } from './middleware/maintenanceLimiter.js';

const app = express();

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
app.use(express.json());
// Parse urlencoded bodies so a bare HTML <form> POST (the classic CSRF vector,
// which needs no JavaScript and triggers no CORS preflight) is understood.
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Throttle before authentication, CSRF validation and database controllers so
// even rejected writes share the feature's per-IP budget.
app.use('/api/maintenance', maintenanceLimiter);

app.get('/api/csrf-token', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// Protect all API writes, including bookings, account edits and logout.
// These two POSTs run before a session exists and must remain exempt.
app.use('/api', (req, res, next) => {
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const preAuth = req.method === 'POST' && /^\/auth\/(login|register)\/?$/i.test(req.path);
  if (safe || preAuth) return next();
  requireAuth(req, res, () => doubleCsrfProtection(req, res, next));
});

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Not found
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  if (err === invalidCsrfTokenError) {
    return res.status(403).json({ code: 'EBADCSRFTOKEN', message: 'Invalid or missing CSRF token' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
