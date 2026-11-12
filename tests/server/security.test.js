import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server/src/app.js';
import { MaintenanceRequest } from '../../server/src/models/MaintenanceRequest.js';

// Exercise real routing, authentication and security middleware without MongoDB.
jest.mock('../../server/src/models/MaintenanceRequest.js', () => ({
  MaintenanceRequest: {
    create: jest.fn(async (data) => ({ _id: 'request-id', ...data })),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn()
  }
}));

const owner = '000000000000000000000001';
let auth;
let csrfCookies;
let csrfToken;

beforeAll(async () => {
  process.env.JWT_SECRET = 'middleware-test-secret';
  process.env.CSRF_SECRET = 'middleware-csrf-secret';
  auth = `token=${jwt.sign({ id: owner }, process.env.JWT_SECRET)}`;
  const res = await request(app).get('/api/csrf-token').set('Cookie', auth);
  expect(res.status).toBe(200);
  csrfToken = res.body.csrfToken;
  csrfCookies = res.headers['set-cookie'].map((cookie) => cookie.split(';')[0]);
});

test('forged form submissions cannot reach persistence', async () => {
  const res = await request(app).post('/api/maintenance').set('Cookie', auth)
    .type('form').send({ roomNumber: 'A1', category: 'other', description: 'Forged' });
  expect(res.status).toBe(403);
  expect(MaintenanceRequest.create).not.toHaveBeenCalled();
});

test.each(['post', 'patch', 'delete'])('%s rejects invalid tokens', async (method) => {
  const path = method === 'post' ? '/api/maintenance' : '/api/maintenance/request-id';
  const res = await request(app)[method](path)
    .set('Cookie', [auth, ...csrfCookies].join('; '))
    .set('x-csrf-token', 'invalid').send({});
  expect(res.status).toBe(403);
});

test('a token cannot be reused with another session', async () => {
  const otherAuth = `token=${jwt.sign({ id: 'another-user' }, process.env.JWT_SECRET)}`;
  const res = await request(app).post('/api/maintenance')
    .set('Cookie', [otherAuth, ...csrfCookies].join('; '))
    .set('x-csrf-token', csrfToken).send({});
  expect(res.status).toBe(403);
});

test('authenticated writes with valid tokens reach the controllers', async () => {
  const headers = { Cookie: [auth, ...csrfCookies].join('; '), 'x-csrf-token': csrfToken };
  const created = await request(app).post('/api/maintenance').set(headers)
    .send({ roomNumber: 'A1', category: 'other', description: 'Repair' });
  expect(created.status).toBe(201);
  expect(MaintenanceRequest.create).toHaveBeenCalledWith(expect.objectContaining({ author: owner }));

  const deleteOne = jest.fn().mockResolvedValue({});
  MaintenanceRequest.findById.mockResolvedValue({ author: owner, deleteOne });
  MaintenanceRequest.findByIdAndUpdate.mockResolvedValue({ status: 'resolved' });
  const updated = await request(app).patch('/api/maintenance/request-id')
    .set(headers).send({ status: 'resolved' });
  expect(updated.status).toBe(200);
  expect(updated.body.request.status).toBe('resolved');
  expect((await request(app).delete('/api/maintenance/request-id').set(headers)).status).toBe(200);
  expect(deleteOne).toHaveBeenCalledTimes(1);
});

test('the shared maintenance budget returns 429 before reaching controllers', async () => {
  const statuses = [];
  for (let i = 0; i < 35; i++) {
    statuses.push((await request(app).post('/api/maintenance')).status);
  }
  expect(statuses).toContain(401);
  expect(statuses).toContain(429);
  for (const method of ['get', 'post', 'patch', 'delete']) {
    const res = await request(app)[method]('/api/maintenance/request-id');
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  }
  expect((await request(app).get('/api/health')).status).toBe(200);
});
