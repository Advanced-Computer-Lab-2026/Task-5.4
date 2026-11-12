import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { requireAuth } from './middleware/auth.js';
import {
  generateCsrfToken,
  doubleCsrfProtection
} from './middleware/csrf.js';
import { rateLimit } from 'express-rate-limit';
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
app.get('/api/csrf-token', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

app.use('/api', (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  const preAuthRoutes = ['/auth/login', '/auth/register'];

  if (
    safeMethods.includes(req.method) ||
    (req.method === 'POST' && preAuthRoutes.includes(req.path))
  ) {
    return next();
  }

  requireAuth(req, res, () => {
    doubleCsrfProtection(req, res, next);
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many maintenance requests. Please try again later.'
  }
});

app.use('/api/maintenance', maintenanceLimiter, maintenanceRoutes);

// Not found
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
