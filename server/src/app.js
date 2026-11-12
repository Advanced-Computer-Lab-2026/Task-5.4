import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { csrfProtection, csrfTokenHandler, isCsrfError } from './middleware/csrf.js';
import { apiLimiter, authLimiter, maintenanceLimiter } from './middleware/rateLimit.js';

const app = express();

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));

// DoS protection: rate-limit before doing any other work (body parsing, auth,
// database). CORS runs first so the client can still read the 429 response.
app.use('/api', apiLimiter);
app.use(['/api/auth/login', '/api/auth/register'], authLimiter);
app.use('/api/maintenance', maintenanceLimiter);

app.use(express.json());
// Parse urlencoded bodies so a bare HTML <form> POST (the classic CSRF vector,
// which needs no JavaScript and triggers no CORS preflight) is understood.
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSRF protection: every state-changing request (anything but GET/HEAD/OPTIONS)
// must carry a valid `x-csrf-token` header that matches the CSRF cookie and is
// bound to the caller's session. Only the pre-auth login/register routes are
// exempt (see middleware/csrf.js).
app.use(csrfProtection);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// The client fetches its CSRF token here (a safe GET, so it is not itself checked).
app.get('/api/csrf-token', csrfTokenHandler);

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
  if (isCsrfError(err)) {
    // Missing or invalid CSRF token: refuse before any data is touched.
    return res.status(403).json({ message: 'Invalid or missing CSRF token', code: 'EBADCSRFTOKEN' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
