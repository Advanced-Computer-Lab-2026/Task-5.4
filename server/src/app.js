import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { doubleCsrfProtection, csrfTokenHandler } from './middleware/csrf.js';
import { maintenanceLimiter, maintenanceWriteLimiter } from './middleware/rateLimit.js';

const app = express();

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
// `x-csrf-token` must be an allowed header so our own client can echo the token.
app.use(cors({
  origin: 'http://localhost:5175',
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-csrf-token']
}));
app.use(express.json());
// Parse urlencoded bodies so a bare HTML <form> POST (the classic CSRF vector,
// which needs no JavaScript and triggers no CORS preflight) is understood.
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Rate-limit the maintenance feature per client BEFORE the CSRF check, so every
// request counts (including forged/tokenless writes that CSRF will reject).
// Reads and writes share one budget; writes also have a stricter one.
app.use('/api/maintenance', maintenanceLimiter, maintenanceWriteLimiter);

// Anti-CSRF (double-submit cookie). The client fetches a token here, then sends
// it back in the `x-csrf-token` header on every state-changing request.
app.get('/api/csrf-token', csrfTokenHandler);

// Every POST/PUT/PATCH/DELETE under /api must carry a valid token, except the
// pre-auth routes (login/register) that run before a session exists.
// GET/HEAD/OPTIONS are exempt. See middleware/csrf.js.
app.use('/api', doubleCsrfProtection);

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
  // Missing/invalid anti-CSRF token: refuse without logging a stack trace.
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid CSRF token', code: 'EBADCSRFTOKEN' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
