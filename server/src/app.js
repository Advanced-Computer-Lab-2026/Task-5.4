import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { generateCsrfToken } from './middleware/csrf.js';

const app = express();

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
app.use(express.json());
// Parse urlencoded bodies so a bare HTML <form> POST (the classic CSRF vector,
// which needs no JavaScript and triggers no CORS preflight) is understood.
app.use(express.urlencoded({ extended: true }));
// cookie-parser must come before any middleware that reads cookies (including
// the CSRF validator which reads the signed CSRF cookie).
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- CSRF token endpoint ---
// The legitimate frontend calls this once (before its first mutating request)
// to obtain a fresh CSRF token. The token is safe to expose to JavaScript
// because it is useless without the matching signed cookie, which the browser
// keeps and sends automatically.
// Pre-auth routes (login/register) are exempt — they run before a session
// exists. GET requests (read-only) are also exempt.
// This route is intentionally public: anyone can get a token, but only the
// holder of the matching signed cookie can use it, so an attacker gains nothing.
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Not found
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler — csrf-csrf throws an error with status 403 when validation
// fails; this handler forwards that status so the client sees 403, not 500.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
