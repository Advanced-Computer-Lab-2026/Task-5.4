import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';

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

// The token is returned only to the first-party client and must accompany every
// unsafe request. Keep a dedicated secret in production; JWT_SECRET is a safe
// development/test fallback so this middleware can be initialized at startup.
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  // Bind the signed double-submit token to the current JWT session. Anonymous
  // callers can obtain only a token for the shared unauthenticated state.
  getSessionIdentifier: (req) => req.cookies?.token || 'anonymous',
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Authentication establishes the cookie session, so login and registration
// cannot require a token that does not exist yet. All other state-changing
// endpoints (including logout) are protected; safe methods pass untouched.
app.use((req, res, next) => {
  if (req.method === 'POST' && ['/api/auth/login', '/api/auth/register'].includes(req.path)) {
    return next();
  }
  return doubleCsrfProtection(req, res, next);
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
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
