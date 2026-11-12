import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';

// Extended rate-limit coverage. Limiter counters live in memory for the whole
// file, so the tests below run in order and build on each other's counts:
// maintenance (30/min), auth failures (10/15min), whole API (120/min).

let mongo;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

const MAINTENANCE_LIMIT = 30;

describe('maintenance limiter', () => {
  test('normal usage up to the limit is served, the next request gets 429', async () => {
    const statuses = [];
    for (let i = 0; i < MAINTENANCE_LIMIT; i++) {
      statuses.push((await request(app).get('/api/maintenance')).status);
    }
    expect(statuses.every((s) => s === 200)).toBe(true);

    const blocked = await request(app).get('/api/maintenance');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many/i);
    // Standard headers tell a well-behaved client when to retry.
    expect(blocked.headers['ratelimit-policy']).toBeDefined();
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  test('writes to the throttled feature are refused with 429 before any other work', async () => {
    const res = await request(app)
      .post('/api/maintenance')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'flood' });
    expect(res.status).toBe(429);
  });

  test('other features are not collateral damage', async () => {
    expect((await request(app).get('/api/bookings')).status).toBe(200);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('auth limiter', () => {
  test('successful logins are not counted, repeated failures are throttled', async () => {
    const email = `ratelimit${Date.now()}@test.dev`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Rate Limit', email, password: 'secret123' });
    expect(reg.status).toBe(201);

    // More successful logins than the failure budget: none are refused.
    for (let i = 0; i < 12; i++) {
      const ok = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
      expect(ok.status).toBe(200);
    }

    const failures = [];
    for (let i = 0; i < 11; i++) {
      failures.push((await request(app).post('/api/auth/login').send({ email, password: 'wrong-guess' })).status);
    }
    expect(failures.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(failures[10]).toBe(429);
  });
});

describe('global API limiter', () => {
  test('a flood of any API endpoint is eventually refused with 429', async () => {
    const statuses = [];
    for (let i = 0; i < 150; i++) {
      statuses.push((await request(app).get('/api/health')).status);
    }
    expect(statuses).toContain(200);
    expect(statuses).toContain(429);
  });
});
