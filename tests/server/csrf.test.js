import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';

let mongo;
let counter = 0;

// The first run may download MongoDB's platform binary, which is much slower
// than Jest's default timeout on constrained connections.
jest.setTimeout(10 * 60 * 1000);

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

function cookiePairs(setCookie) {
  return (setCookie || []).map((cookie) => cookie.split(';')[0]);
}

async function registerUser() {
  counter += 1;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Victim', email: `victim${Date.now()}_${counter}@test.dev`, password: 'secret123' });
  expect(response.status).toBe(201);
  return cookiePairs(response.headers['set-cookie']);
}

describe('Maintenance requests — CSRF protection', () => {
  test('accepts an authenticated request carrying a valid CSRF token', async () => {
    let cookies = await registerUser();
    const tokenResponse = await request(app).get('/api/csrf-token').set('Cookie', cookies.join('; '));
    expect(tokenResponse.status).toBe(200);
    cookies = [...cookies, ...cookiePairs(tokenResponse.headers['set-cookie'])];

    const response = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookies.join('; '))
      .set('x-csrf-token', tokenResponse.body.csrfToken)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });

    expect(response.status).toBe(201);
    expect(response.body.request.description).toBe('Leaking tap');
  });

  test('rejects a forged request that has only the victim auth cookie', async () => {
    const authCookies = await registerUser();
    const response = await request(app)
      .post('/api/maintenance')
      .set('Cookie', authCookies.join('; '))
      .set('Origin', 'http://attacker.evil')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });

    expect(response.status).toBe(403);
    const list = await request(app).get('/api/maintenance');
    expect(list.body.requests.find((requestItem) => requestItem.description === 'Forged by attacker via CSRF')).toBeUndefined();
  });
});
