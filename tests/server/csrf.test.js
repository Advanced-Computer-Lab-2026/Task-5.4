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
  async function session() {
    const auth = await registerUser();
    const response = await request(app).get('/api/csrf-token').set('Cookie', auth.join('; '));
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    return { auth, cookies: [...auth, ...cookiePairs(response.headers['set-cookie'])], token: response.body.csrfToken };
  }

  test('the token endpoint requires authentication', async () => {
    expect((await request(app).get('/api/csrf-token')).status).toBe(401);
  });

  test('valid tokens allow create, update, and delete', async () => {
    const user = await session();
    const created = await request(app).post('/api/maintenance')
      .set('Cookie', user.cookies.join('; ')).set('x-csrf-token', user.token)
      .send({ roomNumber: 'B2-104', category: 'other', description: 'Legitimate repair' });
    expect(created.status).toBe(201);
    const path = `/api/maintenance/${created.body.request._id}`;
    const edited = await request(app).patch(path)
      .set('Cookie', user.cookies.join('; ')).set('x-csrf-token', user.token)
      .send({ description: 'Updated repair' });
    expect(edited.status).toBe(200);
    expect(edited.body.request.description).toBe('Updated repair');
    expect((await request(app).delete(path)
      .set('Cookie', user.cookies.join('; ')).set('x-csrf-token', user.token)).status).toBe(200);
  });

  test('cookies alone, headers alone, tampering, and tokens from another session are rejected', async () => {
    const user = await session();
    const other = await session();
    for (const [cookies, token] of [
      [user.cookies, undefined], [user.auth, user.token],
      [user.cookies, 'guessed-token'],
      [[...other.auth, ...user.cookies.filter(c => !c.startsWith('token='))], user.token]
    ]) {
      let attempt = request(app).post('/api/maintenance').set('Cookie', cookies.join('; '));
      if (token) attempt = attempt.set('x-csrf-token', token);
      expect((await attempt.send({ roomNumber: 'X', category: 'other', description: 'Rejected' })).status).toBe(403);
    }
  });

  test('the localhost attacker form returns 403 and leaves data unchanged', async () => {
    const user = await session();
    const before = await request(app).get('/api/maintenance');
    const forged = await request(app).post('/api/maintenance')
      .set('Cookie', user.cookies.join('; ')).set('Origin', 'http://localhost:1337')
      .type('form').send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });
    expect(forged.status).toBe(403);
    const after = await request(app).get('/api/maintenance');
    expect(after.body.requests).toEqual(before.body.requests);
  });

  test.each([
    ['patch', '/api/maintenance/000000000000000000000001'],
    ['delete', '/api/maintenance/000000000000000000000001'],
    ['post', '/api/bookings'],
    ['patch', '/api/users/000000000000000000000001'],
    ['post', '/api/auth/logout']
  ])('%s %s also requires CSRF proof', async (method, path) => {
    const auth = await registerUser();
    expect((await request(app)[method](path).set('Cookie', auth.join('; ')).send({})).status).toBe(403);
  });

  test('login rotates the session, invalidating old CSRF tokens', async () => {
    counter += 1;
    const credentials = { email: `rotate${Date.now()}_${counter}@test.dev`, password: 'secret123' };
    const browser = request.agent(app);
    expect((await browser.post('/api/auth/register').send({ name: 'Resident', ...credentials })).status).toBe(201);
    const oldToken = (await browser.get('/api/csrf-token')).body.csrfToken;
    expect((await browser.post('/api/auth/login').send(credentials)).status).toBe(200);
    expect((await browser.post('/api/auth/logout').set('x-csrf-token', oldToken)).status).toBe(403);
    const newToken = (await browser.get('/api/csrf-token')).body.csrfToken;
    expect(newToken).not.toBe(oldToken);
    expect((await browser.post('/api/auth/logout').set('x-csrf-token', newToken)).status).toBe(200);
    expect((await browser.get('/api/auth/me')).status).toBe(401);
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
