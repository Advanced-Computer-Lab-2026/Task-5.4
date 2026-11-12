import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { csrfTokenHandler, doubleCsrfProtection } from './middleware/csrf.js';
import { maintenanceLimiter } from './middleware/rateLimit.js';

const app = express();

// Don't advertise the framework: removes the `X-Powered-By: Express` header.
// (Hygiene only — it hides a fingerprint, it does not stop any attack.)
app.disable('x-powered-by');

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
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

// Issue the anti-CSRF token, then require it on every state-changing request
// (login/register and safe methods are exempt — see middleware/csrf.js).
app.get('/api/csrf-token', csrfTokenHandler);
app.use(doubleCsrfProtection);

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
// Rate-limit the maintenance feature (reads and writes) against floods/DoS.
app.use('/api/maintenance', maintenanceLimiter, maintenanceRoutes);

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
