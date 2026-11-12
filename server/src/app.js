import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';

const app = express();

app.use(morgan('dev'));

// ---- DoS protection ----
app.use(helmet());

// Throttle the maintenance feature so one client cannot flood it.
// Adjust `limit` to sit below the flood size used in Flow.md / the tests,
// but high enough that normal use is never blocked.
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api/maintenance', maintenanceLimiter);

// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));

// small body limits so huge payloads can't exhaust memory/CPU
app.use(express.json({ limit: '10kb' }));
// Parse urlencoded bodies so a bare HTML <form> POST (the classic CSRF vector,
// which needs no JavaScript and triggers no CORS preflight) is understood.
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ---- CSRF protection (must come after cookieParser, before the routes) ----
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.cookies.token ?? '',
  cookieName: 'csrf-token',
  cookieOptions: {
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // Pre-auth routes run before a session exists, so they cannot carry a
  // session-bound token. GET/HEAD/OPTIONS are already ignored by the library.
  skipCsrfProtection: (req) =>
    req.path === '/api/auth/login' || req.path === '/api/auth/register',
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateToken(req, res) });
});

app.use(doubleCsrfProtection);

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