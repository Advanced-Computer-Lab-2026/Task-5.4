import dotenv from 'dotenv';
// Load .env BEFORE the app is imported. Static imports are hoisted and run
// before this module's body, so app.js (and middleware/csrf.js, which reads
// NODE_ENV at load time to pick the cookie name and `Secure` flag) is imported
// dynamically below instead.
dotenv.config();

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  // Every state-changing request is validated against this secret; refuse to
  // start without it rather than fail on the first write.
  if (!process.env.CSRF_SECRET) throw new Error('CSRF_SECRET is not set');
  const { default: app } = await import('./app.js');
  const { connectDB } = await import('./config/db.js');
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}
bootstrap();
