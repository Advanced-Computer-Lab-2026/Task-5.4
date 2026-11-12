import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { csrfProtection, sendCsrfToken } from './middleware/csrf.js';
import { maintenanceLimiter } from './middleware/rateLimit.js';

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

// Anti-CSRF: every state-changing request (POST/PATCH/PUT/DELETE) must carry a
// valid token in the `x-csrf-token` header. Safe GETs and the pre-auth routes
// (login/register) are exempt. See middleware/csrf.js.
app.use(csrfProtection);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/csrf-token', sendCsrfToken);

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
// Anti-DoS: max 20 requests per minute per client (429 after that).
app.use('/api/maintenance', maintenanceLimiter, maintenanceRoutes);

// Not found
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  // A missing/invalid CSRF token is an expected rejection, not a server bug.
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid or missing CSRF token', code: 'EBADCSRFTOKEN' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
