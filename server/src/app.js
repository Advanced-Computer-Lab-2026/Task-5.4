import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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

// ── CSRF protection (double-submit cookie pattern) ────────────────────────────
// csrf-csrf generates a secret-signed token, stores part of it in an httpOnly
// cookie, and expects the matching value in the x-csrf-token request header.
// An attacker's page can forge the cookie but cannot READ it to build the
// matching header value, so forged requests are rejected with 403.
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.JWT_SECRET,
  cookieName: 'x-csrf-token',
  cookieOptions: { sameSite: 'lax', secure: false, httpOnly: true },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

// Client fetches this once on boot, then sends the value as x-csrf-token header
app.get('/api/csrf-token', doubleCsrfProtection, (req, res) => {
  res.json({ csrfToken: generateToken(req, res) });
});

// ── Rate limiting (DoS fix) ───────────────────────────────────────────────────
// Maintenance and bookings write endpoints are capped to 30 req/min per IP.
// Floods beyond that are rejected with 429 Too Many Requests.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.' },
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Auth routes are intentionally exempt from CSRF — they establish the session
// and the user has no token yet at registration / login time.
app.use('/api/auth', authRoutes);

// All other state-changing routes require a valid CSRF token (double-submit
// cookie pattern). Auth is excluded above so register/login work without one.
app.use('/api/bookings', doubleCsrfProtection, writeLimiter, bookingRoutes);
app.use('/api/users', doubleCsrfProtection, userRoutes);
app.use('/api/maintenance', doubleCsrfProtection, writeLimiter, maintenanceRoutes);

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
