import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { csrfProtection, issueCsrfToken } from './middleware/csrf.js';
import { maintenanceLimiter, maintenanceWriteLimiter } from './middleware/rateLimit.js';

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

// Hand the SPA a CSRF token for its current session. This is a safe GET, so the
// protection below lets it through. An attacker's page can trigger the request
// but can't read the token out of the response (Same-Origin Policy + CORS).
app.get('/api/csrf-token', issueCsrfToken);

// Throttle the maintenance feature so one client can't flood it (DoS). This is
// mounted BEFORE the CSRF check on purpose. A flood of forged writes still
// counts against the budget and gets a 429, instead of each request reaching
// the CSRF check without limit.
app.use('/api/maintenance', maintenanceLimiter, maintenanceWriteLimiter);

// CSRF protection for every state-changing request on every router. It's
// mounted globally on purpose, so a write route added later can't silently miss
// it. Safe methods and the pre-auth routes (login/register) are exempt; see
// middleware/csrf.js.
app.use(csrfProtection);

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
  // `code` (e.g. EBADCSRFTOKEN) tells the client it can refresh its CSRF token and retry.
  res.status(err.status || 500).json({ message: err.message || 'Server Error', code: err.code });
});

export default app;
