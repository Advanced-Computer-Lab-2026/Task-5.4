import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server/src/app.js';
import { MaintenanceRequest } from '../../server/src/models/MaintenanceRequest.js';

// Exercise the real middleware even when the MongoDB binary is unavailable.
// Only the final database write is stubbed; cookies, signing and HTTP are real.
describe('HTTP security middleware without database setup', () => {
  let cookies;
  let token;
  let create;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'middleware-test-secret';
    process.env.CSRF_SECRET = 'middleware-test-csrf-secret';
    const auth = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, { jwtid: 'session-one' });
    const res = await request(app).get('/api/csrf-token').set('Cookie', `token=${auth}`);
    expect(res.status).toBe(200);
    token = res.body.csrfToken;
    cookies = [`token=${auth}`, ...res.headers['set-cookie'].map(c => c.split(';')[0])].join('; ');
    create = jest.spyOn(MaintenanceRequest, 'create').mockImplementation(async value => value);
  });

  afterAll(() => jest.restoreAllMocks());

  test('the forged localhost form is rejected before a database write', async () => {
    const res = await request(app).post('/api/maintenance')
      .set('Cookie', cookies).set('Origin', 'http://localhost:1337').type('form')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' });
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  test('a valid session and double-submit token reach the controller', async () => {
    const res = await request(app).post('/api/maintenance')
      .set('Cookie', cookies).set('x-csrf-token', token)
      .send({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].author).toBe('507f1f77bcf86cd799439011');
  });

  test('a flood is refused before CSRF validation or database work', async () => {
    let rejected;
    for (let i = 0; i < 35; i++) {
      const res = await request(app).post('/api/maintenance').set('Cookie', cookies);
      expect([403, 429]).toContain(res.status);
      if (res.status === 429) rejected = res;
    }
    expect(rejected).toBeDefined();
    expect(Number(rejected.headers['retry-after'])).toBeGreaterThan(0);
    expect(create).toHaveBeenCalledTimes(1);
    // The same budget covers public reads and detail routes.
    expect((await request(app).get('/api/maintenance')).status).toBe(429);
    expect((await request(app).get('/api/maintenance/123')).status).toBe(429);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});
