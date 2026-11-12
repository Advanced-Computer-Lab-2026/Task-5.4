import request from 'supertest';
import { spawnSync } from 'child_process';
import path from 'path';

// Production vs development CSRF cookie configuration, and startup behavior.
// csrf.js reads NODE_ENV when it is first loaded, so each case loads a fresh
// copy of the app module graph.

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

async function loadApp(nodeEnv) {
  jest.resetModules();
  process.env.NODE_ENV = nodeEnv;
  process.env.CSRF_SECRET = 'test-csrf-secret';
  process.env.JWT_SECRET = 'test-secret';
  return (await import('../../server/src/app.js')).default;
}

async function csrfCookieFor(nodeEnv) {
  const app = await loadApp(nodeEnv);
  const res = await request(app).get('/api/csrf-token');
  expect(res.status).toBe(200);
  return res.headers['set-cookie'].find((c) => c.includes('x-csrf-token='));
}

describe('CSRF cookie configuration', () => {
  test('production: __Host- prefixed, Secure, HttpOnly, SameSite=Strict, Path=/', async () => {
    const cookie = await csrfCookieFor('production');
    expect(cookie.startsWith('__Host-dorm.x-csrf-token=')).toBe(true);
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Domain=/i); // required by the __Host- prefix
  });

  test('development: plain cookie name, not Secure, so plain http://localhost works', async () => {
    const cookie = await csrfCookieFor('development');
    expect(cookie.startsWith('dorm.x-csrf-token=')).toBe(true);
    expect(cookie).not.toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });
});

describe('server startup', () => {
  const indexPath = path.resolve(__dirname, '../../server/src/index.js');

  function startServer(env) {
    // Run the real entry point in a child process; it must exit on its own
    // (missing secret) before it ever touches the database.
    return spawnSync(process.execPath, [indexPath], {
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8',
      timeout: 20000
    });
  }

  test('refuses to start without CSRF_SECRET', () => {
    const result = startServer({ JWT_SECRET: 'x', MONGO_URI: 'mongodb://127.0.0.1:1/none' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/CSRF_SECRET is not set/);
  });
});
