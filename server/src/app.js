import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import rateLimit from 'express-rate-limit';
import { requireAuth } from './middleware/auth.js';
import { csrfProtection, issueCsrfToken } from './middleware/csrf.js';

const app = express();

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));

// DoS protection: one client may make at most 30 maintenance requests per minute.
// Mounted BEFORE the CSRF check so rejected/forged floods are counted too.
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
app.use('/api/maintenance', maintenanceLimiter);
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// CSRF: token endpoint, then require the token on every state-changing request
// (login/register are exempt inside csrfProtection).
app.get('/api/csrf-token', requireAuth, issueCsrfToken);
app.use('/api', csrfProtection);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
