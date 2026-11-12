import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';

const app = express();

const csrf = doubleCsrf({
  getSecret: () => {
    if (!process.env.CSRF_SECRET || Buffer.byteLength(process.env.CSRF_SECRET, 'utf8') < 32) {
      throw new Error('CSRF_SECRET must be set to a strong random secret of at least 32 bytes');
    }
    return process.env.CSRF_SECRET;
  },
  getSessionIdentifier: (req) => req.cookies?.csrf_session,
  cookieName: 'csrf-token',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
app.use(express.json());
// Parse urlencoded bodies so a bare HTML <form> POST (the classic CSRF vector,
// which needs no JavaScript and triggers no CORS preflight) is understood.
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Give each browser session a random identifier so CSRF tokens can be issued
// before login and remain bound to that browser session after authentication.
app.use((req, res, next) => {
  if (!req.cookies?.csrf_session) {
    req.cookies.csrf_session = crypto.randomUUID();
    res.cookie('csrf_session', req.cookies.csrf_session, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/'
    });
  }
  next();
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: csrf.generateCsrfToken(req, res) });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Cookie-authenticated writes across the API require CSRF proof. Login and
// registration are exempt because no authenticated session exists yet.
app.use('/api', (req, res, next) => {
  const isPreAuth = req.method === 'POST' && ['/auth/login', '/auth/register'].includes(req.path);
  if (isPreAuth) return next();
  return csrf.doubleCsrfProtection(req, res, next);
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
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
