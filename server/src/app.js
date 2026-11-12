
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';

import { requireAuth } from './middleware/auth.js';
import { generateCsrfToken } from './middleware/csrf.js';

const app = express();

app.use(morgan('dev'));

app.use(cors({
  origin: 'http://localhost:5175',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Give authenticated users a CSRF token
app.get('/api/csrf-token', requireAuth, (req, res, next) => {
  try {
    const csrfToken = generateCsrfToken(req, res);
    return res.json({ csrfToken });
  } catch (err) {
    next(err);
  }
});

// Existing application routes
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
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      message: 'Invalid CSRF token'
    });
  }

  console.error(err);

  return res.status(err.status || err.statusCode || 500).json({
    message: err.message || 'Server Error'
  });
});

export default app;
