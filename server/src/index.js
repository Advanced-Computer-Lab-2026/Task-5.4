import dotenv from 'dotenv';
dotenv.config();
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  // The CSRF tokens are signed with this secret; refuse to start without it.
  if (!process.env.CSRF_SECRET) throw new Error('CSRF_SECRET is not set');
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}
bootstrap();
