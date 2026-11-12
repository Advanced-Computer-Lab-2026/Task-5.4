import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';

let mongo;
beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('maintenance request rate limit', () => {
  test('normal public reads succeed', async () => {
    const response = await request(app).get('/api/maintenance');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.requests)).toBe(true);
  });

  test('a client flood is refused with 429 after the configured limit', async () => {
    const statuses = [];
    for (let i = 0; i < 101; i += 1) {
      const response = await request(app).get('/api/maintenance');
      statuses.push(response.status);
    }
    expect(statuses).toContain(200);
    expect(statuses).toContain(429);
  }, 30000);
});
