import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';

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

function cookiePairs(setCookie) {
  return (setCookie || []).map(cookie => cookie.split(';')[0]);
}

let counter = 0;

async function registerUser() {
  counter += 1;
  const email = `victim${Date.now()}_${counter}@test.dev`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Victim', email, password: 'secret123' });

  expect(response.status).toBe(201);
  return cookiePairs(response.headers['set-cookie']);
}

describe('Maintenance requests — CSRF protection', () => {
  test('an authenticated user can file a maintenance request with a CSRF token', async () => {
    const authCookies = await registerUser();
    const tokenResponse = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', authCookies.join('; '));
    const cookies = [
      ...authCookies,
      ...cookiePairs(tokenResponse.headers['set-cookie'])
    ];

    const response = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookies.join('; '))
      .set('x-csrf-token', tokenResponse.body.csrfToken)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });

    expect(tokenResponse.status).toBe(200);
    expect(response.status).toBe(201);
    expect(response.body.request.description).toBe('Leaking tap');
  });

  test('a forged request without a CSRF token is rejected without writing data', async () => {
    const authCookies = await registerUser();
    const forged = await request(app)
      .post('/api/maintenance')
      .set('Cookie', authCookies.join('; '))
      .set('Origin', 'http://attacker.evil')
      .send({
        roomNumber: 'Z9-666',
        category: 'other',
        description: 'Forged by attacker via CSRF'
      });

    expect(forged.status).toBe(403);

    const list = await request(app).get('/api/maintenance');
    expect(list.body.requests.some(
      item => item.description === 'Forged by attacker via CSRF'
    )).toBe(false);
  });
});
