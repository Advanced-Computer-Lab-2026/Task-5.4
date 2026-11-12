import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';
import { MaintenanceRequest } from '../../server/src/models/MaintenanceRequest.js';

let mongo;
let counter = 0;
const maintenance = { roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' };

beforeAll(async () => {
  process.env.JWT_SECRET = 'regression-test-secret';
  process.env.CSRF_SECRET = 'regression-csrf-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function session() {
  const agent = request.agent(app);
  const email = `regression${++counter}@test.dev`;
  const registration = await agent.post('/api/auth/register')
    .send({ name: 'Resident', email, password: 'secret123' });
  expect(registration.status).toBe(201);
  const token = await agent.get('/api/csrf-token');
  expect(token.status).toBe(200);
  expect(token.headers['cache-control']).toBe('no-store');
  const authCookie = registration.headers['set-cookie'].find(cookie => cookie.startsWith('token=')).split(';')[0];
  return { agent, email, authCookie, csrfToken: token.body.csrfToken };
}

test('CSRF tokens are issued only to authenticated sessions', async () => {
  const res = await request(app).get('/api/csrf-token');
  expect(res.status).toBe(401);
});

test('the demo HTML form cannot create maintenance data even on another localhost port', async () => {
  const { agent } = await session();
  const before = await MaintenanceRequest.countDocuments();
  const res = await agent.post('/api/maintenance')
    .set('Origin', 'http://localhost:1337').type('form').send(maintenance);
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('EBADCSRFTOKEN');
  expect(await MaintenanceRequest.countDocuments()).toBe(before);
});

test('valid tokens allow create/update/delete while forged updates and deletes leave data unchanged', async () => {
  const { agent, csrfToken } = await session();
  const created = await agent.post('/api/maintenance').set('x-csrf-token', csrfToken).send(maintenance);
  expect(created.status).toBe(201);
  const path = `/api/maintenance/${created.body.request._id}`;

  expect((await agent.patch(path).send({ description: 'Forged update' })).status).toBe(403);
  expect((await agent.delete(path)).status).toBe(403);
  const unchanged = await agent.get(path);
  expect(unchanged.status).toBe(200);
  expect(unchanged.body.request.description).toBe(maintenance.description);

  const updated = await agent.patch(path).set('x-csrf-token', csrfToken).send({ status: 'resolved' });
  expect(updated.status).toBe(200);
  expect(updated.body.request.status).toBe('resolved');
  expect((await agent.delete(path).set('x-csrf-token', csrfToken)).status).toBe(200);
  expect((await agent.get(path)).status).toBe(404);
});

test('tampered tokens and tokens copied from another session are rejected', async () => {
  const first = await session();
  const second = await session();
  for (const token of ['invalid-token', first.csrfToken]) {
    const res = await second.agent.post('/api/maintenance').set('x-csrf-token', token).send(maintenance);
    expect(res.status).toBe(403);
  }
  // Even copying both halves of the double-submit pair cannot cross sessions.
  const copied = await request(app).post('/api/maintenance')
    .set('Cookie', `${second.authCookie}; csrf-token=${encodeURIComponent(first.csrfToken)}`)
    .set('x-csrf-token', first.csrfToken).send(maintenance);
  expect(copied.status).toBe(403);
});

test('logging in again rotates the session and invalidates its previous CSRF token', async () => {
  const { agent, email, csrfToken } = await session();
  const login = await agent.post('/api/auth/login').send({ email, password: 'secret123' });
  expect(login.status).toBe(200);
  const newAuthCookie = login.headers['set-cookie'].find(cookie => cookie.startsWith('token=')).split(';')[0];
  const stale = await request(app).post('/api/maintenance')
    .set('Cookie', `${newAuthCookie}; csrf-token=${encodeURIComponent(csrfToken)}`)
    .set('x-csrf-token', csrfToken).send(maintenance);
  expect(stale.status).toBe(403);
  const current = await agent.get('/api/csrf-token');
  expect(current.status).toBe(200);
  expect(current.body.csrfToken).not.toBe(csrfToken);
  const valid = await agent.post('/api/maintenance')
    .set('x-csrf-token', current.body.csrfToken).send(maintenance);
  expect(valid.status).toBe(201);
});

test('bookings, user changes and logout also require CSRF protection', async () => {
  const { agent, csrfToken } = await session();
  expect((await agent.post('/api/bookings').send({})).status).toBe(403);
  expect((await agent.patch('/api/users/000000000000000000000000').send({})).status).toBe(403);
  const forgedLogout = await agent.post('/api/auth/logout');
  expect(forgedLogout.status).toBe(403);
  expect((await agent.get('/api/auth/me')).status).toBe(200);
  expect((await agent.post('/api/auth/logout').set('x-csrf-token', csrfToken)).status).toBe(200);
  expect((await agent.get('/api/auth/me')).status).toBe(401);
});
