import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';

import { doubleCsrf } from 'csrf-csrf';

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

// CSRF protection configuration
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,

  // Bind the CSRF token to the user's authenticated session
  getSessionIdentifier: (req) => req.cookies.token || req.ip,

  cookieName: 'csrf-token',

  cookieOptions: {httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/'},
   // These methods do not modify server data
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],

  // The client sends its CSRF token in this header
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

app.use((req, res, next) => {
  const isPreAuth =
    req.method === 'POST' &&
    ['/api/auth/login', '/api/auth/register'].includes(req.path);

  if (isPreAuth) {
    return next();
  }

  return doubleCsrfProtection(req, res, next);
});

// Endpoint used by the legitimate client to obtain a CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({
    csrfToken: generateCsrfToken(req, res)
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

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
