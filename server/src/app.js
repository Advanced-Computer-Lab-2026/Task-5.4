import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { generateCsrfToken, doubleCsrfProtection } from './middleware/csrf.js';
import { maintenanceLimiter } from './middleware/rateLimit.js';

const app = express();

app.use(morgan('dev'));
// CORS alone does NOT stop CSRF: it only blocks reading responses, not sending requests.
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// DoS: rate-limit every maintenance call (placed before CSRF so forged floods are counted too)
app.use('/api/maintenance', maintenanceLimiter);

// CSRF: hand the client a token (GET = safe, exempt)
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// CSRF: require the token on every POST/PUT/PATCH/DELETE (login/register exempt)
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

// CSRF failures -> clean JSON 403
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid or missing CSRF token' });
  }
  next(err);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;