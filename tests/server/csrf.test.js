import request from 'supertest';
import { resetModels } from '../helpers/memoryModels.js';
import app from '../../server/src/app.js';

jest.mock('../../server/src/models/User.js', () => ({
  User: require('../helpers/memoryModels.js').User
}));
jest.mock('../../server/src/models/MaintenanceRequest.js', () => ({
  MaintenanceRequest: require('../helpers/memoryModels.js').MaintenanceRequest
}));

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CSRF_SECRET = 'test-csrf-secret';
});

beforeEach(resetModels);

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

    // The real client fetches a session-bound token first.
    let cookies = [...authCookies];
    const headers = {};
    const tokenRes = await request(app).get('/api/csrf-token').set('Cookie', cookies.join('; '));
    expect(tokenRes.status).toBe(200);
    expect(tokenRes.headers['cache-control']).toBe('no-store');
    expect(tokenRes.body.csrfToken).toEqual(expect.any(String));
    headers['x-csrf-token'] = tokenRes.body.csrfToken;
    cookies = [...cookies, ...cookiePairs(tokenRes.headers['set-cookie'])];

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
