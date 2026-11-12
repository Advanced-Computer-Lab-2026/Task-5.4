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

// CORS locked to the client origin(s); credentials so the auth cookie is sent.
// NOTE: CORS alone does NOT stop CSRF. It only controls who can READ responses;
// a cross-site form POST is still sent by the browser with the cookie attached.
app.use(cors({
  origin: ['http://localhost:5175', 'http://localhost:5173'], // keep the port(s) your Vite client uses
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-csrf-token'],
}));

// DoS: cap body sizes
app.use(express.json({ limit: '10kb' }));
// Needed so a bare HTML <form> POST (classic CSRF vector) is parsed and then rejected
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// DoS: rate limiting (responds 429 when exceeded)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later.' },
});
app.use(generalLimiter);
app.use('/api/auth', authLimiter);

// Pre-auth routes: no session exists yet, so there is nothing to forge.
const CSRF_EXEMPT = ['/api/auth/login', '/api/auth/register'];

// CSRF: double-submit cookie token (csrf-csrf v4 exports generateCsrfToken)
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'dev-csrf-secret',
  getSessionIdentifier: (req) => req.cookies?.token ?? '', // must match your auth cookie's name
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  skipCsrfProtection: (req) => CSRF_EXEMPT.includes(req.originalUrl.split('?')[0]),
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Client calls this to get a token (before the protection middleware)
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// Protects all POST/PUT/PATCH/DELETE routes below (GET/HEAD/OPTIONS are ignored by default)
app.use(doubleCsrfProtection);

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Not found
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler (csrf-csrf errors arrive here with status 403)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || err.statusCode || 500).json({ message: err.message || 'Server Error' });
});

export default app;