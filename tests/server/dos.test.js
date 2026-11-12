import request from 'supertest';
import mongoose from 'mongoose';
import 'dotenv/config';
import app from '../../server/src/app.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  await mongoose.connect(process.env.MONGO_URI);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
});

describe('Maintenance requests - DoS / rate limiting', () => {
  test('normal request to the public list succeeds', async () => {
    const res = await request(app).get('/api/maintenance');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.requests)).toBe(true);
  }, 30000);

  test('flood of requests from one client is rate-limited', async () => {
    const statuses = [];
    for (let i = 0; i < 40; i++) {
      const res = await request(app).get('/api/maintenance');
      statuses.push(res.status);
    }
    expect(statuses).toContain(200);
    expect(statuses).toContain(429);
  }, 60000);
});