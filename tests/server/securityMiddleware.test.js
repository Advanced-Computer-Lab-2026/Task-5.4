import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server/src/app.js';
import { MaintenanceRequest } from '../../server/src/models/MaintenanceRequest.js';

// Exercise the real app, authentication, CSRF library, limiter and controller.
// Only database operations are replaced, so these checks need no Mongo binary.
jest.mock('../../server/src/models/MaintenanceRequest.js', () => ({
  MaintenanceRequest: { create: jest.fn(), find: jest.fn() }
}));

const secret = 'middleware-test-jwt-secret';
let writes;
beforeAll(() => {
  process.env.JWT_SECRET = secret;
  process.env.CSRF_SECRET = 'middleware-test-csrf-secret';
  writes = [];
  MaintenanceRequest.create.mockImplementation(async value => {
    writes.push(value);
    return { _id: 'request-id', ...value };
  });
  MaintenanceRequest.find.mockImplementation(() => ({
    populate: () => ({ sort: () => ({ lean: async () => writes }) })
  }));
});

async function session(id) {
  const auth = `token=${jwt.sign({ id }, secret, { jwtid: id })}`;
  const res = await request(app).get('/api/csrf-token').set('Cookie', auth);
  expect(res.status).toBe(200);
  return {
    auth,
    token: res.body.csrfToken,
    csrf: res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
  };
}

test('authenticated HTML forgery is rejected without reaching database writes', async () => {
  const user = await session('victim');
  const res = await request(app).post('/api/maintenance')
    .set('Cookie', user.auth).set('Origin', 'http://localhost:1337').type('form')
    .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });
  expect(res.status).toBe(403);
  expect(writes).toHaveLength(0);
});

test('signed double-submit token allows a legitimate write and rejects tampering/replay', async () => {
  const first = await session('first');
  const second = await session('second');
  const body = { roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' };
  const valid = await request(app).post('/api/maintenance')
    .set('Cookie', `${first.auth}; ${first.csrf}`).set('x-csrf-token', first.token).send(body);
  expect(valid.status).toBe(201);
  expect(valid.body.request.author).toBe('first');
  for (const [auth, token] of [[first.auth, 'tampered'], [second.auth, first.token]]) {
    const forged = await request(app).post('/api/maintenance')
      .set('Cookie', `${auth}; ${first.csrf}`).set('x-csrf-token', token).send(body);
    expect(forged.status).toBe(403);
  }
  expect(writes).toHaveLength(1);
});

test('other writes require CSRF, safe reads work, and authenticated logout clears cookies', async () => {
  const user = await session('owner');
  for (const [method, url] of [['patch', '/api/maintenance/123'], ['delete', '/api/maintenance/123'], ['post', '/api/bookings'], ['patch', '/api/users/123'], ['post', '/api/auth/logout']]) {
    expect((await request(app)[method](url).set('Cookie', user.auth)).status).toBe(403);
  }
  expect((await request(app).get('/api/maintenance')).status).toBe(200);
  const logout = await request(app).post('/api/auth/logout')
    .set('Cookie', `${user.auth}; ${user.csrf}`).set('x-csrf-token', user.token);
  expect(logout.status).toBe(200);
  expect(logout.headers['set-cookie'].some(c => c.startsWith('token=;'))).toBe(true);
});

test('maintenance flood returns 429 before more database queries', async () => {
  const statuses = [];
  for (let i = 0; i < 35; i++) statuses.push((await request(app).get('/api/maintenance')).status);
  expect(statuses).toContain(200);
  expect(statuses).toContain(429);
  const count = MaintenanceRequest.find.mock.calls.length;
  const blocked = await request(app).get('/api/maintenance');
  expect(blocked.status).toBe(429);
  expect(blocked.headers['retry-after']).toBeDefined();
  expect(MaintenanceRequest.find).toHaveBeenCalledTimes(count);
  expect((await request(app).get('/api/health')).status).toBe(200);
});
