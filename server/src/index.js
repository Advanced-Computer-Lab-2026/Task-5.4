import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  for (const name of ['JWT_SECRET', 'CSRF_SECRET']) {
    if (!process.env[name]) throw new Error(`${name} is not set`);
  }
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}
bootstrap();
