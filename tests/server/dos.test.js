import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';

let mongo;

// The first run may download MongoDB's platform binary, which is much slower
// than Jest's default timeout on constrained connections.
jest.setTimeout(10 * 60 * 1000);

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('Maintenance requests — DoS protection', () => {
  test('serves normal traffic but throttles a single-client flood', async () => {
    const statuses = [];
    for (let index = 0; index < 40; index += 1) {
      const response = await request(app).get('/api/maintenance');
      statuses.push(response.status);
    }

    expect(statuses).toContain(200);
    expect(statuses).toContain(429);
  });
});
