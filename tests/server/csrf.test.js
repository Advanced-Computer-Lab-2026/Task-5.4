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
}, 300000);

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

describe('CSRF session binding and write coverage', () => {
  test('token issuance requires authentication', async () => {
    expect((await request(app).get('/api/csrf-token')).status).toBe(401);
  });

  test('a token copied from another session cannot authorize a write', async () => {
    const first = await registerUser();
    const second = await registerUser();
    const token = await request(app).get('/api/csrf-token').set('Cookie', first.join('; '));
    expect(token.status).toBe(200);
    const res = await request(app).post('/api/maintenance')
      .set('Cookie', [...second, ...cookiePairs(token.headers['set-cookie'])].join('; '))
      .set('x-csrf-token', token.body.csrfToken)
      .send({ roomNumber: 'A1', category: 'other', description: 'Must not be created' });
    expect(res.status).toBe(403);
  });

  test('plain HTML form forgery is rejected and all write routes require CSRF', async () => {
    const cookies = await registerUser();
    for (const [method, path] of [
      ['post', '/api/maintenance'], ['patch', '/api/maintenance/123'],
      ['delete', '/api/maintenance/123'], ['post', '/api/bookings'],
      ['patch', '/api/users/123'], ['delete', '/api/users/123'],
      ['post', '/api/auth/logout']
    ]) {
      const res = await request(app)[method](path).set('Cookie', cookies.join('; '))
        .type('form').send({ description: 'Forged by attacker via CSRF' });
      expect(res.status).toBe(403);
    }
  });

  test('login is exempt, and a valid CSRF token permits logout', async () => {
    const agent = request.agent(app);
    const email = `login${Date.now()}@test.dev`;
    expect((await agent.post('/api/auth/register').send({ name: 'Login test', email, password: 'secret123' })).status).toBe(201);
    expect((await agent.post('/api/auth/login').send({ email, password: 'secret123' })).status).toBe(200);
    const token = await agent.get('/api/csrf-token');
    expect(token.headers['cache-control']).toBe('no-store');
    expect((await agent.post('/api/auth/logout').set('x-csrf-token', token.body.csrfToken)).status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});


test('legitimate maintenance edits/deletes retain ownership checks', async () => {
  const owner = request.agent(app);
  const other = request.agent(app);
  for (const [agent, name] of [[owner, 'Owner'], [other, 'Other']]) {
    const res = await agent.post('/api/auth/register').send({ name, email: `${name}${Date.now()}@test.dev`, password: 'secret123' });
    expect(res.status).toBe(201);
  }
  const ownerToken = (await owner.get('/api/csrf-token')).body.csrfToken;
  const otherToken = (await other.get('/api/csrf-token')).body.csrfToken;
  const created = await owner.post('/api/maintenance').set('x-csrf-token', ownerToken)
    .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });
  expect(created.status).toBe(201);
  const path = '/api/maintenance/' + created.body.request._id;
  expect((await other.patch(path).set('x-csrf-token', otherToken).send({ status: 'resolved' })).status).toBe(403);
  const updated = await owner.patch(path).set('x-csrf-token', ownerToken).send({ status: 'resolved' });
  expect(updated.status).toBe(200);
  expect(updated.body.request.status).toBe('resolved');
  expect((await owner.delete(path).set('x-csrf-token', ownerToken)).status).toBe(200);
});
