import request from 'supertest';
import jwt from 'jsonwebtoken';
import { api } from '../client/src/api.js';
import app from '../server/src/app.js';
import { MaintenanceRequest } from '../server/src/models/MaintenanceRequest.js';

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.CSRF_SECRET = 'test-csrf-secret';
process.env.JWT_EXPIRES_IN = '1h';

function authCookie() {
  const token = jwt.sign({ id: 'resident-1', name: 'Resident' }, process.env.JWT_SECRET);
  return `token=${token}`;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Security behavior', () => {
  test('sends requests with credentials so the auth cookie is included', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  test('allows an authenticated maintenance write with a CSRF token', async () => {
    const login = await request(app).post('/api/auth/login').send({});
    const register = await request(app).post('/api/auth/register').send({});
    expect(login.status).toBe(400);
    expect(register.status).toBe(400);

    const cookie = authCookie();
    const tokenRes = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', cookie);
    expect(tokenRes.status).toBe(200);
    const csrfCookie = tokenRes.headers['set-cookie'][0].split(';')[0];

    jest.spyOn(MaintenanceRequest, 'create').mockResolvedValue({
      _id: 'request-1',
      description: 'Leaking tap'
    });

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', `${cookie}; ${csrfCookie}`)
      .set('x-csrf-token', tokenRes.body.csrfToken)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });

    expect(res.status).toBe(201);
    expect(res.body.request.description).toBe('Leaking tap');
  });

  test('rejects a forged maintenance write and leaves the database unchanged', async () => {
    const createRequest = jest.spyOn(MaintenanceRequest, 'create');

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', authCookie())
      .set('Origin', 'http://attacker.evil')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });

    expect(res.status).toBe(403);
    expect(createRequest).not.toHaveBeenCalled();
  });

  test('allows a normal request to the public maintenance list', async () => {
    jest.spyOn(MaintenanceRequest, 'find').mockImplementation(() => ({
      populate() { return this; },
      sort() { return this; },
      lean() { return Promise.resolve([]); }
    }));

    const res = await request(app).get('/api/maintenance');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.requests)).toBe(true);
  });

  test('rate-limits a flood of maintenance reads', async () => {
    jest.spyOn(MaintenanceRequest, 'find').mockImplementation(() => ({
      populate() { return this; },
      sort() { return this; },
      lean() { return Promise.resolve([]); }
    }));
    const statuses = [];
    for (let i = 0; i < 40; i += 1) {
      const res = await request(app).get('/api/maintenance');
      statuses.push(res.status);
    }

    expect(statuses).toContain(200);
    expect(statuses).toContain(429);
  });
  test('attaches the fetched token to a mutating request', async () => {
    const sent = [];
    api.defaults.adapter = async config => {
      if (config.url === '/csrf-token') {
        return { data: { csrfToken: 'test-token' }, status: 200, statusText: 'OK', headers: {}, config };
      }
      sent.push(config);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };

    await api.post('/maintenance', {
      roomNumber: 'B2-104',
      category: 'plumbing',
      description: 'Leaking tap'
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].headers.get('x-csrf-token')).toBe('test-token');
  });
});
