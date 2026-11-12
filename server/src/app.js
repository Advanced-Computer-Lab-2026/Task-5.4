import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { csrfProtection } from './middleware/csrf.js';
import { apiLimiter, authLimiter, writeLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';

const app = express();

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({
  origin: 'http://localhost:5175',
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));
// Rate limiters run before body parsing so floods are rejected cheaply.
// If deployed behind a reverse proxy, also set: app.set('trust proxy', 1)
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', writeLimiter);

// Body size is capped at 10kb (Express defaults to 100kb).
app.use(express.json({ limit: '10kb' }));
// Parse urlencoded bodies so a bare HTML <form> POST (the classic CSRF vector,
// which needs no JavaScript and triggers no CORS preflight) is understood.
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
// Reject state-changing requests that lack a matching CSRF header.
app.use('/api', csrfProtection);

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
