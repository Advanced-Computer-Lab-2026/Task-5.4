import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';

let mongo;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  mongo = new MongoMemoryServer();
  await mongo.start();
  await mongoose.connect(mongo.getUri());
}, 60000);

afterAll(async () => {
  try {
    await mongoose.disconnect();
  } finally {
    if (mongo) await mongo.stop();
  }
}, 30000);

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
    const res = await request(app).get('/api/csrf-token').set('Cookie', auth.join('; '));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    return { auth, cookies: [...auth, ...cookiePairs(res.headers['set-cookie'])], token: res.body.csrfToken };
  }

  test('the localhost attacker form is refused and leaves data unchanged', async () => {
    const { cookies } = await session();
    const before = await mongoose.connection.collection('maintenancerequests').countDocuments();
    const res = await request(app).post('/api/maintenance')
      .set('Cookie', cookies.join('; ')).set('Origin', 'http://localhost:1337')
      .type('form').send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });
    expect(res.status).toBe(403);
    expect(await mongoose.connection.collection('maintenancerequests').countDocuments()).toBe(before);
  });

  test('a token cannot be transferred to a different session', async () => {
    const first = await session();
    const second = await session();
    const csrfCookie = first.cookies.filter(c => !c.startsWith('token='));
    const res = await request(app).post('/api/maintenance')
      .set('Cookie', [...second.auth, ...csrfCookie].join('; '))
      .set('x-csrf-token', first.token)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Replay' });
    expect(res.status).toBe(403);
  });

  test('create, update, and delete work with a token; missing or wrong headers fail', async () => {
    const { cookies, token } = await session();
    const cookie = cookies.join('; ');
    const created = await request(app).post('/api/maintenance')
      .set('Cookie', cookie).set('x-csrf-token', token)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });
    expect(created.status).toBe(201);
    const url = `/api/maintenance/${created.body.request._id}`;
    expect((await request(app).patch(url).set('Cookie', cookie).send({ status: 'resolved' })).status).toBe(403);
    expect((await request(app).delete(url).set('Cookie', cookie).set('x-csrf-token', 'wrong')).status).toBe(403);
    expect((await request(app).patch(url).set('Cookie', cookie).set('x-csrf-token', token).send({ status: 'resolved' })).body.request.status).toBe('resolved');
    expect((await request(app).delete(url).set('Cookie', cookie).set('x-csrf-token', token)).status).toBe(200);
  });

  test.each([
    ['post', '/api/bookings'], ['patch', '/api/users/123'],
    ['delete', '/api/bookings/123'], ['post', '/api/auth/logout']
  ])('%s %s requires a CSRF token', async (method, url) => {
    const auth = await registerUser();
    expect((await request(app)[method](url).set('Cookie', auth.join('; ')).send({})).status).toBe(403);
  });

  test('a new login rotates the session and logout requires a valid token', async () => {
    const agent = request.agent(app);
    const email = `login${Date.now()}@test.dev`;
    const registration = await agent.post('/api/auth/register').send({ name: 'Victim', email, password: 'secret123' });
    const old = await agent.get('/api/csrf-token');
    const login = await agent.post('/api/auth/login').send({ email, password: 'secret123' });
    expect(login.status).toBe(200);
    expect(cookiePairs(login.headers['set-cookie']).find(c => c.startsWith('token=')))
      .not.toBe(cookiePairs(registration.headers['set-cookie']).find(c => c.startsWith('token=')));
    expect((await agent.post('/api/auth/logout').set('x-csrf-token', old.body.csrfToken)).status).toBe(403);
    const fresh = await agent.get('/api/csrf-token');
    expect((await agent.post('/api/auth/logout').set('x-csrf-token', fresh.body.csrfToken)).status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
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
