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

// --- CSRF protection (double-submit cookie pattern via csrf-csrf) ---
const {
  generateCsrfToken,   // creates the token + sets the __csrf cookie
  doubleCsrfProtection // middleware that validates the token on state-changing requests
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'csrf-secret-default-key',
  getSessionIdentifier: (req) => req.cookies?.token || '',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,      // true in production (HTTPS only)
    path: '/'
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Endpoint the client calls once to obtain a CSRF token. The token is returned
// in the response body; a matching __csrf cookie is set at the same time.
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Auth routes are exempt from CSRF: login/register run before a session exists,
// and logout is a simple cookie-clear. Mount them BEFORE the CSRF middleware.
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);

// Apply CSRF protection to all routes mounted AFTER this line.
// Safe methods (GET, HEAD, OPTIONS) are ignored by csrf-csrf by default.
app.use(doubleCsrfProtection);

app.use('/api/maintenance', maintenanceRoutes);

// Not found
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler — catch csrf-csrf's InvalidCsrfTokenError and return 403.
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN' || err.message === 'invalid csrf token') {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
