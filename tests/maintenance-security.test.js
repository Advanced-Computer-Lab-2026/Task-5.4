import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server/src/app.js';
import { MaintenanceRequest } from '../server/src/models/MaintenanceRequest.js';
import { User } from '../server/src/models/User.js';

process.env.JWT_SECRET = 'jest-only-secret';
process.env.CSRF_SECRET = 'jest-only-csrf-secret-at-least-32-bytes';
let mongo;
const resident = { id: '64b000000000000000000001', name: 'Test Resident' };
const authCookie = `token=${jwt.sign(resident, process.env.JWT_SECRET)}`;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  await MaintenanceRequest.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('maintenance security', () => {
  test('keeps registration exempt and rejects logout without CSRF proof', async () => {
    const registration = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Resident', email: 'preauth@test.dev', password: 'secret123' });
    expect(registration.status).toBe(201);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', authCookie);
    expect(logout.status).toBe(403);
  });

  test('rejects forged cross-site POST, PATCH, and DELETE requests with HTTP 403 and no changes', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const forgedPost = await request(app)
      .post('/api/maintenance')
      .set('Cookie', [authCookie, 'csrf_session=attacker-unknown-session'])
      .set('Origin', 'http://localhost:1337')
      .type('form')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged request' });
    const forgedPatch = await request(app)
      .patch('/api/maintenance/64b000000000000000000002')
      .set('Cookie', [authCookie, 'csrf_session=attacker-unknown-session'])
      .set('Origin', 'http://localhost:1337')
      .send({ status: 'resolved' });
    const forgedDelete = await request(app)
      .delete('/api/maintenance/64b000000000000000000002')
      .set('Cookie', [authCookie, 'csrf_session=attacker-unknown-session'])
      .set('Origin', 'http://localhost:1337');

    expect([forgedPost.status, forgedPatch.status, forgedDelete.status]).toEqual([403, 403, 403]);
    expect(await MaintenanceRequest.countDocuments()).toBe(0);
    errorLog.mockRestore();
  });

  test('accepts a legitimate state change with a session CSRF token', async () => {
    const issued = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', 'csrf_session=legitimate-test-session');
    expect(issued.status).toBe(200);
    expect(issued.body.csrfToken).toEqual(expect.any(String));
    const csrfCookies = issued.headers['set-cookie'] || [];
    const cookies = [
      authCookie,
      'csrf_session=legitimate-test-session',
      ...csrfCookies.map((cookie) => cookie.split(';')[0])
    ];

    const response = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookies)
      .set('x-csrf-token', issued.body.csrfToken)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });

    expect(response.status).toBe(201);
    expect(await MaintenanceRequest.countDocuments()).toBe(1);
  });

  test('limits maintenance API requests and responds with HTTP 429 when exceeded', async () => {
    const browser = request.agent(app);
    let lastResponse;
    for (let i = 0; i < 31; i += 1) {
      lastResponse = await browser.get('/api/maintenance');
    }
    expect(lastResponse.status).toBe(429);
  });
});
