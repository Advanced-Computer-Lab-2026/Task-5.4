import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { generateCsrfToken, doubleCsrfProtection } from './middleware/csrf.js';

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

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Public endpoint the client calls to obtain an anti-CSRF token. The same token
// is set in an httpOnly cookie; the client echoes the JSON value back in the
// `x-csrf-token` header. The attacker cannot read either one, so it cannot forge
// the header/cookie pair a protected request requires.
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// Pre-auth routes (login/register/logout) run before a session exists, so they
// must stay exempt — otherwise a user could never obtain a first token.
app.use('/api/auth', authRoutes);

// Protect every state-changing request that follows (maintenance, bookings,
// users). GET/HEAD/OPTIONS are ignored by the middleware, so safe reads and the
// token endpoint above remain exempt.
app.use(doubleCsrfProtection);

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
  // csrf-csrf raises an http-errors error carrying `statusCode` (403); honour it
  // alongside Express's conventional `status` so the forged request is refused
  // with 403 rather than falling through to a 500.
  res.status(err.status || err.statusCode || 500).json({ message: err.message || 'Server Error' });
});

export default app;
