import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import app from '../server/src/app.js';
import { csrfProtection, issueCsrfToken } from '../server/src/middleware/csrf.js';
import { api, clearCsrfToken } from '../client/src/api.js';

process.env.JWT_SECRET = 'test-only-secret';
const cookie = (response) => (response.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
const session = id => `token=${jwt.sign({ id: 'resident' }, process.env.JWT_SECRET, { jwtid: id })}`;

test('token endpoint requires authentication; safe app reads remain available', async () => {
  assert.equal((await request(app).get('/api/csrf-token')).status, 401);
  assert.equal((await request(app).get('/api/health')).status, 200);
});

test('application rejects forged writes before database controllers', async () => {
  for (const path of ['/api/maintenance', '/api/bookings', '/api/auth/logout']) {
    assert.equal((await request(app).post(path).set('Cookie', session('victim')).send({})).status, 403);
  }
  assert.equal((await request(app).post('/api/auth/login').send({})).status, 400);
  assert.equal((await request(app).post('/api/auth/register').send({})).status, 400);
});

test('signed double-submit allows valid writes and rejects tampering and session reuse', async () => {
  const fixture = express();
  fixture.use(cookieParser());
  fixture.get('/token', issueCsrfToken);
  let writes = 0;
  fixture.post('/write', csrfProtection, (req, res) => { writes++; res.sendStatus(204); });
  fixture.use((err, req, res, next) => res.sendStatus(err.status || 500));
  const auth = session('first');
  const issued = await request(fixture).get('/token').set('Cookie', auth);
  const token = issued.body.csrfToken;
  const csrfCookie = cookie(issued);
  const write = (authCookie, header) => request(fixture).post('/write').set('Cookie', `${authCookie}; ${csrfCookie}`).set('x-csrf-token', header);
  assert.equal((await write(auth, token)).status, 204);
  assert.equal((await write(auth, token)).status, 204);
  assert.equal((await write(auth, `${token}x`)).status, 403);
  assert.equal((await write(session('second'), token)).status, 403);
  assert.equal(writes, 2);
  const appToken = await request(app).get('/api/csrf-token').set('Cookie', auth);
  assert.equal(appToken.status, 200);
  assert.equal(appToken.headers['cache-control'], 'no-store');
  const logout = await request(app).post('/api/auth/logout').set('Cookie', `${auth}; ${cookie(appToken)}`).set('x-csrf-token', appToken.body.csrfToken);
  assert.equal(logout.status, 200);
});

test('frontend fetches tokens once for concurrent writes and refreshes after reset', async () => {
  clearCsrfToken();
  const captured = [];
  let fetches = 0;
  api.defaults.adapter = async config => {
    const data = config.url === '/csrf-token' ? { csrfToken: `token-${++fetches}` } : {};
    captured.push(config);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  await api.post('/auth/login', {});
  assert.equal(fetches, 0);
  await Promise.all([api.post('/maintenance', {}), api.patch('/bookings/1', {})]);
  assert.equal(fetches, 1);
  for (const config of captured.filter(c => ['/maintenance', '/bookings/1'].includes(c.url))) {
    assert.equal(config.headers.get('x-csrf-token'), 'token-1');
  }
  clearCsrfToken();
  await api.delete('/maintenance/1');
  assert.equal(fetches, 2);
});
