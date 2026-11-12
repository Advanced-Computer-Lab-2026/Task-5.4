import dotenv from 'dotenv';
dotenv.config();
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  if (!process.env.CSRF_SECRET) {
    console.error('CSRF_SECRET is not set. Add it to server/.env (any long random string).');
    process.exit(1);
  }

  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}
bootstrap();
