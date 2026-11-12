import request from 'supertest';
import mongoose from 'mongoose';
import 'dotenv/config';
import app from '../../server/src/app.js';
import { MaintenanceRequest } from '../../server/src/models/MaintenanceRequest.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  await mongoose.connect(process.env.MONGO_URI);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await MaintenanceRequest.deleteMany({});
});

function cookiePairs(setCookie) {
  return (setCookie || []).map((c) => c.split(';')[0]);
}

let counter = 0;
async function registerUser() {
  counter += 1;
  const email = `victim${Date.now()}_${counter}@test.dev`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Victim', email, password: 'secret123' });
  expect(res.status).toBe(201);
  return cookiePairs(res.headers['set-cookie']);
}

describe('Maintenance requests - CSRF protection', () => {
  test('happy path: logged-in user files a request with a valid token', async () => {
    const authCookies = await registerUser();

    let cookies = [...authCookies];
    const headers = {};
    const tokenRes = await request(app).get('/api/csrf-token').set('Cookie', cookies.join('; '));
    if (tokenRes.status === 200) {
      headers['x-csrf-token'] = tokenRes.body.csrfToken;
      cookies = [...cookies, ...cookiePairs(tokenRes.headers['set-cookie'])];
    }

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookies.join('; '))
      .set(headers)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });
    expect(res.status).toBe(201);
    expect(res.body.request.description).toBe('Leaking tap');
  }, 30000);

  test('forged cross-site request with no CSRF token is rejected', async () => {
    const authCookies = await registerUser();

    const forged = await request(app)
      .post('/api/maintenance')
      .set('Cookie', authCookies.join('; '))
      .set('Origin', 'http://attacker.evil')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });
    expect(forged.status).toBe(403);

    const list = await request(app).get('/api/maintenance');
    const forgedItem = list.body.requests.find((r) => r.description === 'Forged by attacker via CSRF');
    expect(forgedItem).toBeUndefined();
  }, 30000);
});