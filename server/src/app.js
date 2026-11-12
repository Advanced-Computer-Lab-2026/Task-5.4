import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requireAuth } from './middleware/auth.js';
import { issueCsrfToken, protectFromCsrf } from './middleware/csrf.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';

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
// The legitimate client reads the token from this authenticated endpoint and
// echoes it in a custom header. A third-party page cannot read this response.
app.get('/api/csrf-token', requireAuth, issueCsrfToken);

// Protect every state-changing API route, with explicit pre-auth exceptions
// for login and registration. Safe methods remain available without a token.
app.use(protectFromCsrf);

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
