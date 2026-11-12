import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { csrfProtection, getCsrfToken, invalidCsrfTokenError } from './middleware/csrf.js';
import { maintenanceLimiter, csrfTokenLimiter } from './middleware/rateLimit.js';

const app = express();

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF:
// it only stops other origins from READING responses — such as /api/csrf-token.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
app.use(express.json());
// Parse urlencoded bodies so plain HTML-form bodies are understood. A forged
// <form> POST can't carry the x-csrf-token header, so csrfProtection rejects it.
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// DoS: throttle the maintenance feature per client. Mounted before the CSRF
// check so a flood of (forged or legitimate) requests is cut off first.
app.use('/api/maintenance', maintenanceLimiter);

// CSRF: the client fetches a per-session token here and echoes it back in the
// x-csrf-token header on every write.
app.get('/api/csrf-token', csrfTokenLimiter, getCsrfToken);

// CSRF: every state-changing request (POST/PUT/PATCH/DELETE) must carry a valid
// token. Safe methods and the pre-auth login/register routes are exempt.
app.use(csrfProtection);

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
    // A missing/invalid token: refuse the write without touching the data.
    return res.status(403).json({ message: 'Invalid or missing CSRF token', code: 'EBADCSRFTOKEN' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
