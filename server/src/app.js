import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import csrfRoutes from './routes/csrf.js';

const app = express();

// Sensible security headers (CSP-friendly defaults; no-op for the API tests).
app.use(helmet());
app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF
// — it only stops the attacker from READING responses. The anti-CSRF token in
// middleware/csrf.js is what refuses forged writes.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
// Parse JSON bodies, but cap their size so a giant payload cannot exhaust
// memory (a small extra DoS hardening).
app.use(express.json({ limit: '16kb' }));
// Parse urlencoded bodies so plain HTML <form> POSTs are understood — the
// classic CSRF vector, which is exactly why writes require an anti-CSRF token.
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Issues the anti-CSRF token the client echoes on every write (GET is safe).
app.use('/api', csrfRoutes);
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
