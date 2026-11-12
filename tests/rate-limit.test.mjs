import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server/src/app.js';
import { MaintenanceRequest } from '../server/src/models/MaintenanceRequest.js';

test('maintenance flood stops before database work and shares a budget across routes', async () => {
  let queries = 0;
  mock.method(MaintenanceRequest, 'find', () => {
    queries++;
    return { populate() { return this; }, sort() { return this; }, lean: async () => [] };
  });
  try {
    for (let i = 0; i < 30; i++) {
      const response = await request(app).get('/api/maintenance');
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.requests, []);
    }
    for (const [method, path] of [
      ['get', '/api/maintenance'],
      ['get', '/api/maintenance/123'],
      ['post', '/api/maintenance'],
      ['patch', '/api/maintenance/123'],
      ['delete', '/api/maintenance/123']
    ]) {
      const response = await request(app)[method](path);
      assert.equal(response.status, 429);
      assert.ok(Number(response.headers['retry-after']) > 0);
      assert.ok(response.headers.ratelimit);
      assert.match(response.body.message, /Too many maintenance requests/);
    }
    assert.equal(queries, 30);
    // Unrelated endpoints do not consume or share the maintenance budget.
    assert.equal((await request(app).get('/api/health')).status, 200);
  } finally {
    mock.restoreAll();
  }
});
