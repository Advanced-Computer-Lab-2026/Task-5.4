import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { csrfProtection, csrfTokenHandler } from './middleware/csrf.js';

const app = express();

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
app.use(express.json());
// Parse urlencoded bodies. A bare HTML <form> POST (the classic CSRF vector)
// is still parsed, but it can't carry the x-csrf-token header, so
// csrfProtection below rejects it.
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// The client fetches a CSRF token here and echoes it in the x-csrf-token header
// on every state-changing request.
app.get('/api/csrf-token', csrfTokenHandler);

// Require a valid CSRF token on every state-changing request (POST/PATCH/PUT/
// DELETE) across the API. GET/HEAD/OPTIONS and the pre-auth login/register
// routes are exempt. A forged cross-site request has no token, so it gets 403.
app.use(csrfProtection);

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
  if (err.code !== 'EBADCSRFTOKEN') console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error', code: err.code });
});

export default app;
