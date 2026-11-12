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

function cookiePairs(setCookie = []) {
  return setCookie.map((cookie) => cookie.split(';')[0]);
}

let counter = 0;
async function registerUser() {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Victim',
    email: `victim-${Date.now()}-${++counter}@test.dev`,
    password: 'secret123'
  });
  expect(res.status).toBe(201);
  return cookiePairs(res.headers['set-cookie']);
}

describe('maintenance CSRF protection', () => {
  test('a logged-in client can submit with its session CSRF token', async () => {
    const cookies = await registerUser();
    const tokenResponse = await request(app)
      .get('/api/maintenance/csrf-token')
      .set('Cookie', cookies.join('; '));
    expect(tokenResponse.status).toBe(200);

    const allCookies = [...cookies, ...cookiePairs(tokenResponse.headers['set-cookie'])];
    const response = await request(app)
      .post('/api/maintenance')
      .set('Cookie', allCookies.join('; '))
      .set('x-csrf-token', tokenResponse.body.csrfToken)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });
    expect(response.status).toBe(201);
    expect(response.body.request.description).toBe('Leaking tap');
  });

  test('a forged write without a CSRF token is rejected without changing data', async () => {
    const cookies = await registerUser();
    const before = await request(app).get('/api/maintenance');
    expect(before.status).toBe(200);

    const forged = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookies.join('; '))
      .set('Origin', 'http://attacker.evil')
      .type('form')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });
    expect(forged.status).toBe(403);

    const after = await request(app).get('/api/maintenance');
    expect(after.status).toBe(200);
    expect(after.body.requests).toHaveLength(before.body.requests.length);
    expect(after.body.requests.some((item) => item.description === 'Forged by attacker via CSRF')).toBe(false);
  });
});
