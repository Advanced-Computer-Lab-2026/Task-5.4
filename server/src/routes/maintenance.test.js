import request from 'supertest';
import app from '../../src/app.js';
import {
  createRequest,
  getAllRequests
} from '../controllers/maintenanceController.js';

jest.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'test-user' };
    next();
  }
}));

jest.mock('../controllers/maintenanceController.js', () => ({
  getAllRequests: jest.fn((req, res) => res.json({ requests: [] })),
  getRequest: jest.fn(),
  createRequest: jest.fn((req, res) => res.status(201).json({ ok: true })),
  updateRequest: jest.fn(),
  deleteRequest: jest.fn()
}));

describe('maintenance route protections', () => {
  test('allows safe GET requests without a CSRF token', async () => {
    const response = await request(app).get('/api/maintenance');

    expect(response.status).toBe(200);
    expect(getAllRequests).toHaveBeenCalled();
  });

  test('rejects a state-changing request without a CSRF token', async () => {
    const response = await request(app)
      .post('/api/maintenance')
      .send({ description: 'Test request' });

    expect(response.status).toBe(403);
    expect(createRequest).not.toHaveBeenCalled();
  });

  test('rejects a state-changing request when cookie and header tokens differ', async () => {
    const response = await request(app)
      .post('/api/maintenance')
      .set('Cookie', 'csrfToken=cookie-token')
      .set('X-CSRF-Token', 'header-token')
      .send({ description: 'Test request' });

    expect(response.status).toBe(403);
    expect(createRequest).not.toHaveBeenCalled();
  });

  test('allows a state-changing request when cookie and header tokens match', async () => {
    const response = await request(app)
      .post('/api/maintenance')
      .set('Cookie', 'csrfToken=valid-token')
      .set('X-CSRF-Token', 'valid-token')
      .send({ description: 'Test request' });

    expect(response.status).toBe(201);
    expect(createRequest).toHaveBeenCalled();
  });

  test('returns 429 after the maintenance rate limit is exceeded', async () => {
    const responses = [];

    for (let i = 0; i < 31; i += 1) {
      responses.push(await request(app).get('/api/maintenance'));
    }

    expect(responses.some(response => response.status === 429)).toBe(true);
    expect(responses.at(-1).body.message).toMatch(/too many maintenance requests/i);
  });
});
