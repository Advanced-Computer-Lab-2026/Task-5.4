import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';

async function session() {
  const auth = await registerUser();
  const res = await request(app).get('/api/csrf-token').set('Cookie', auth.join('; '));
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('no-store');
  return { cookies: [...auth, ...cookiePairs(res.headers['set-cookie'])].join('; '), token: res.body.csrfToken };
}

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
  test('CSRF token issuance requires an authenticated session', async () => {
    expect((await request(app).get('/api/csrf-token')).status).toBe(401);
  });

  test('a token and cookie copied from another session are rejected', async () => {
    const first = await session();
    const secondAuth = await registerUser();
    const csrfCookie = first.cookies.split('; ').filter(c => !c.startsWith('token='));
    const res = await request(app).post('/api/maintenance')
      .set('Cookie', [...secondAuth, ...csrfCookie].join('; '))
      .set('x-csrf-token', first.token)
      .send({ roomNumber: 'X1', category: 'other', description: 'Cross-session forgery' });
    expect(res.status).toBe(403);
  });

  test('forged HTML forms fail; valid owners can update/delete and others cannot', async () => {
    const owner = await session();
    const body = { roomNumber: 'A1', category: 'other', description: 'Broken chair' };
    const forged = await request(app).post('/api/maintenance')
      .set('Cookie', owner.cookies).set('Origin', 'http://localhost:1337')
      .type('form').send(body);
    expect(forged.status).toBe(403);
    const created = await request(app).post('/api/maintenance')
      .set('Cookie', owner.cookies).set('x-csrf-token', owner.token).send(body);
    expect(created.status).toBe(201);
    const url = `/api/maintenance/${created.body.request._id}`;
    expect((await request(app).get(url)).status).toBe(200);
    for (const method of ['patch', 'delete']) {
      expect((await request(app)[method](url).set('Cookie', owner.cookies).send({ status: 'resolved' })).status).toBe(403);
    }
    const other = await session();
    expect((await request(app).delete(url).set('Cookie', other.cookies).set('x-csrf-token', other.token)).status).toBe(403);
    const updated = await request(app).patch(url).set('Cookie', owner.cookies)
      .set('x-csrf-token', owner.token).send({ status: 'resolved' });
    expect(updated.status).toBe(200);
    expect(updated.body.request.status).toBe('resolved');
    expect((await request(app).delete(url).set('Cookie', owner.cookies).set('x-csrf-token', owner.token)).status).toBe(200);
  });

  test('all other writes including logout require CSRF, while pre-auth routes are exempt', async () => {
    const owner = await session();
    for (const [method, path] of [['post', '/api/bookings'], ['patch', '/api/users/123'], ['post', '/api/auth/logout']]) {
      expect((await request(app)[method](path).set('Cookie', owner.cookies).send({})).status).toBe(403);
    }
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
    const logout = await request(app).post('/api/auth/logout').set('Cookie', owner.cookies).set('x-csrf-token', owner.token);
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie'].some(c => c.startsWith('csrf-token=;'))).toBe(true);
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
