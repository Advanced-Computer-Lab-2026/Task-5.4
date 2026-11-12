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
async function registerUser() {
  counter += 1;
  const email = `victim${Date.now()}_${counter}@test.dev`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Victim', email, password: 'secret123' });
  expect(res.status).toBe(201);
  // The auth cookie the browser will now send automatically on every request.
  return cookiePairs(res.headers['set-cookie']);
}

describe('Maintenance requests — CSRF protection', () => {
  test('the token endpoint requires an authenticated session', async () => {
    const res = await request(app).get('/api/csrf-token');
    expect(res.status).toBe(401);
  });

  test('a token from another session cannot authorize a write', async () => {
    const firstSession = await registerUser();
    const secondSession = await registerUser();
    const tokenRes = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', firstSession.join('; '));
    expect(tokenRes.status).toBe(200);
    expect(tokenRes.headers['cache-control']).toBe('no-store');

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', [...secondSession, ...cookiePairs(tokenRes.headers['set-cookie'])].join('; '))
      .set('x-csrf-token', tokenRes.body.csrfToken)
      .send({ roomNumber: 'B2-104', category: 'other', description: 'Wrong session' });
    expect(res.status).toBe(403);
    const list = await request(app).get('/api/maintenance');
    expect(list.body.requests.some((r) => r.description === 'Wrong session')).toBe(false);
  });

  test('a CSRF cookie without its matching header cannot authorize a write', async () => {
    const session = await registerUser();
    const tokenRes = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', session.join('; '));
    expect(tokenRes.status).toBe(200);
    const cookies = [...session, ...cookiePairs(tokenRes.headers['set-cookie'])];

    for (const headers of [{}, { 'x-csrf-token': 'incorrect-token' }]) {
      const res = await request(app)
        .post('/api/maintenance')
        .set('Cookie', cookies.join('; '))
        .set(headers)
        .send({ roomNumber: 'B2-104', category: 'other', description: 'Invalid token' });
      expect(res.status).toBe(403);
    }
    const list = await request(app).get('/api/maintenance');
    expect(list.body.requests.some((r) => r.description === 'Invalid token')).toBe(false);
  });

  test('all authenticated write routes require CSRF proof', async () => {
    const cookies = await registerUser();
    for (const [method, path] of [
      ['patch', '/api/maintenance/000000000000000000000000'],
      ['delete', '/api/maintenance/000000000000000000000000'],
      ['post', '/api/bookings'],
      ['patch', '/api/users/000000000000000000000000'],
      ['delete', '/api/users/000000000000000000000000'],
      ['post', '/api/auth/logout']
    ]) {
      const res = await request(app)[method](path).set('Cookie', cookies.join('; '));
      expect(res.status).toBe(403);
    }
  });

  test('a logged-in user can file a maintenance request (the happy path)', async () => {
    const authCookies = await registerUser();

    // The real client fetches a CSRF token first. The vulnerable app has no such
    // endpoint (404) — tolerate that so this control test passes in both projects.
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
