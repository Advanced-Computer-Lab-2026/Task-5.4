import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import app from '../../server/src/app.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'session-test-secret';
  process.env.CSRF_SECRET = 'session-test-csrf-secret';
});

function session() {
  return 'token=' + jwt.sign({ id: 'same-user' }, process.env.JWT_SECRET,
    { jwtid: randomUUID(), expiresIn: '1h' });
}
async function tokenFor(cookie) {
  const res = await request(app).get('/api/csrf-token').set('Cookie', cookie);
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('no-store');
  return { token: res.body.csrfToken,
    cookie: res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') };
}

test('token issuance requires authentication', async () => {
  expect((await request(app).get('/api/csrf-token')).status).toBe(401);
});

test.each([
  ['post', '/api/maintenance'], ['patch', '/api/maintenance/123'],
  ['delete', '/api/maintenance/123'], ['post', '/api/bookings'],
  ['patch', '/api/bookings/123'], ['delete', '/api/bookings/123'],
  ['patch', '/api/users/123'], ['delete', '/api/users/123'],
  ['post', '/api/auth/logout']
])('%s %s rejects an authenticated write without CSRF before its handler', async (method, path) => {
  const res = await request(app)[method](path).set('Cookie', session()).send({});
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('EBADCSRFTOKEN');
});

test('a mismatched header is rejected and a valid token permits logout', async () => {
  const auth = session();
  const csrf = await tokenFor(auth);
  const cookies = auth + '; ' + csrf.cookie;
  const bad = await request(app).post('/api/auth/logout').set('Cookie', cookies)
    .set('x-csrf-token', 'invalid');
  expect(bad.status).toBe(403);
  const good = await request(app).post('/api/auth/logout').set('Cookie', cookies)
    .set('x-csrf-token', csrf.token);
  expect(good.status).toBe(200);
  expect(good.headers['set-cookie'].some(c => c.startsWith('token=;'))).toBe(true);
  expect(good.headers['set-cookie'].some(c => c.startsWith('csrf-token=;'))).toBe(true);
});

test('a token cannot be replayed in another JWT session for the same user', async () => {
  const csrf = await tokenFor(session());
  const newAuth = session();
  const res = await request(app).post('/api/auth/logout')
    .set('Cookie', newAuth + '; ' + csrf.cookie).set('x-csrf-token', csrf.token);
  expect(res.status).toBe(403);
  const fresh = await tokenFor(newAuth + '; ' + csrf.cookie);
  expect(fresh.token).not.toBe(csrf.token);
  const valid = await request(app).post('/api/auth/logout')
    .set('Cookie', newAuth + '; ' + fresh.cookie).set('x-csrf-token', fresh.token);
  expect(valid.status).toBe(200);
});
