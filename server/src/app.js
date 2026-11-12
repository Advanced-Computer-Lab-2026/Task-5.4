import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';

const app = express();

// Don't advertise "X-Powered-By: Express" — it tells attackers what we run.
app.disable('x-powered-by');

app.use(morgan('dev'));
// CORS is locked to the client origin with credentials enabled so the browser
// may send the auth cookie on cross-origin XHR. (CORS alone does NOT stop CSRF.)
app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
app.use(express.json());
// Parse urlencoded bodies so a bare HTML <form> POST (the classic CSRF vector,
// which needs no JavaScript and triggers no CORS preflight) is understood.
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// CSRF protection (double-submit cookie pattern via csrf-csrf).
//
// The server issues a signed token two ways: in a JSON body (which the client
// reads and echoes back in the `x-csrf-token` header) and in an httpOnly
// cookie. A state-changing request is accepted only if the header matches the
// cookie. An attacker's page can make the browser SEND cookies, but cannot READ
// our cookies or responses, and a plain HTML form cannot set custom headers —
// so a forged request arrives without a valid token and is rejected with 403.
// ---------------------------------------------------------------------------
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  // Read lazily so the secret can come from .env (index.js) or be set by tests.
  getSecret: () => process.env.CSRF_SECRET,
  // Bind each token to the current login session (the JWT auth cookie).
  getSessionIdentifier: (req) => req.cookies.token ?? '',
  // The default "__Host-" prefixed name requires HTTPS; we run on http://localhost.
  cookieName: 'x-csrf-token',
  cookieOptions: { sameSite: 'strict', secure: false, httpOnly: true, path: '/' },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Hands the client a token (and sets the matching cookie).
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// Protect every state-changing request. GET/HEAD/OPTIONS are ignored by
// csrf-csrf automatically ("safe" methods). Login/register are exempt because
// they run before a session exists, so there is nothing to bind a token to.
const CSRF_EXEMPT = ['/api/auth/login', '/api/auth/register'];
app.use((req, res, next) =>
  CSRF_EXEMPT.includes(req.path) ? next() : doubleCsrfProtection(req, res, next)
);

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