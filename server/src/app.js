import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import userRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import { doubleCsrf } from 'csrf-csrf';
import rateLimit from 'express-rate-limit';

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

// CSRF protection (double-submit cookie pattern).
// The token is signed with CSRF_SECRET and tied to the user's auth cookie, so a
// token from one session is useless in another. The attacker's page can make the
// browser SEND cookies, but cannot READ the token or set the x-csrf-token header.
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.cookies.token ?? '',
  // No "__Host-" prefix: browsers only accept that prefix on Secure (HTTPS) cookies.
  cookieName: 'csrf-token',
  cookieOptions: { sameSite: 'lax', secure: false, httpOnly: true, path: '/' },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// DoS protection: one client may make at most 20 maintenance requests per minute.
// Anything above that is refused with 429 Too Many Requests before doing any work.
const maintenanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

// The client calls this to get a token before each state-changing request.
app.get('/api/csrf-token', (req, res) => res.json({ csrfToken: generateCsrfToken(req, res) }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
// Order matters: rate-limit first (cheap refusal of floods), then require a CSRF
// token on POST/PATCH/DELETE (GET/HEAD/OPTIONS are skipped, so reading stays public).
app.use('/api/maintenance', maintenanceLimiter, doubleCsrfProtection, maintenanceRoutes);

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
