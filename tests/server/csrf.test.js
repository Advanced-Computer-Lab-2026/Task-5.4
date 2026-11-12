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

// Turn a response's Set-Cookie header into the "name=value" pairs a browser
// would echo back in the Cookie header on the next request.
function cookiePairs(setCookie) {
  return (setCookie || []).map((c) => c.split(';')[0]);
}

let counter = 0;
async function registerUser(email = `student${Date.now()}_${counter}@test.dev`) {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Victim', email, password: 'secret123' });
  expect(res.status).toBe(201);
  // The auth cookie the browser will now send automatically on every request.
  return cookiePairs(res.headers['set-cookie']);
}

describe('Maintenance requests — CSRF protection', () => {
  test('a logged-in user can file a maintenance request (the happy path)', async () => {
    const authCookies = await registerUser();

    const tokenRes = await request(app).get('/api/csrf-token').set('Cookie', authCookies.join('; '));
    expect(tokenRes.status).toBe(200);
    const cookies = [...authCookies, ...cookiePairs(tokenRes.headers['set-cookie'])];

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookies.join('; '))
      .set('x-csrf-token', tokenRes.body.csrfToken)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });
    expect(res.status).toBe(201);
    expect(res.body.request.description).toBe('Leaking tap');
  });

  test('a CSRF token is bound to one login session, even for the same account', async () => {
    const email = 'session-binding@test.dev';
    const firstSession = await registerUser(email);
    const issued = await request(app).get('/api/csrf-token').set('Cookie', firstSession.join('; '));
    expect(issued.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
    expect(login.status).toBe(200);
    const cookies = [...cookiePairs(login.headers['set-cookie']), ...cookiePairs(issued.headers['set-cookie'])];

    const logout = await request(app).post('/api/auth/logout')
      .set('Cookie', cookies.join('; '))
      .set('x-csrf-token', issued.body.csrfToken);
    expect(logout.status).toBe(403);
  });

  // The core CSRF test. A forged cross-site request carries the victim's auth
  // cookie (the browser sends it automatically) but NO anti-CSRF token. A secure
  // server must reject it; a vulnerable one performs the state change.
  test('a forged cross-site request with no CSRF token is rejected', async () => {
    const authCookies = await registerUser();

    const forged = await request(app)
      .post('/api/maintenance')
      .set('Cookie', authCookies.join('; ')) // only the auth cookie — as in a real CSRF
      .set('Origin', 'http://attacker.evil') // request originates off-site
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });

    // Secure behavior: refuse the request for lack of a valid CSRF token.
    expect(forged.status).toBe(403);

    // And no forged request must have been written to the database.
    const list = await request(app).get('/api/maintenance');
    const forgedItem = list.body.requests.find((r) => r.description === 'Forged by attacker via CSRF');
    expect(forgedItem).toBeUndefined();
  });
});
