import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server/src/app.js';

// Extended CSRF coverage: which requests need a token, which are exempt, and
// the ways a token can be invalid (missing, mismatched, wrong session, sent in
// the body instead of the header).

let mongo;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

function cookiePairs(setCookie) {
  return (setCookie || []).map((c) => c.split(';')[0]);
}

function cookieHeader(pairs) {
  return pairs.join('; ');
}

let counter = 0;
async function registerUser() {
  counter += 1;
  const email = `resident${Date.now()}_${counter}@test.dev`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Resident', email, password: 'secret123' });
  expect(res.status).toBe(201);
  return { email, user: res.body.user, authCookies: cookiePairs(res.headers['set-cookie']) };
}

// Fetch a CSRF token the way the client does; returns the token and the full
// cookie jar (auth cookie + CSRF cookie) the browser would then hold.
async function getCsrf(authCookies = []) {
  const res = await request(app).get('/api/csrf-token').set('Cookie', cookieHeader(authCookies));
  expect(res.status).toBe(200);
  return {
    token: res.body.csrfToken,
    cookies: [...authCookies, ...cookiePairs(res.headers['set-cookie'])],
    setCookie: res.headers['set-cookie']
  };
}

async function loggedInSession() {
  const { authCookies, user, email } = await registerUser();
  const { token, cookies } = await getCsrf(authCookies);
  return { user, email, authCookies, token, cookies };
}

async function fileRequest({ cookies, token }, description = 'Broken lamp') {
  const res = await request(app)
    .post('/api/maintenance')
    .set('Cookie', cookieHeader(cookies))
    .set('x-csrf-token', token)
    .send({ roomNumber: 'C3-201', category: 'electrical', description });
  expect(res.status).toBe(201);
  return res.body.request;
}

async function findByDescription(description) {
  const list = await request(app).get('/api/maintenance');
  return list.body.requests.find((r) => r.description === description);
}

describe('CSRF token endpoint', () => {
  test('GET /api/csrf-token returns a token and sets it in an httpOnly cookie', async () => {
    const { authCookies } = await registerUser();
    const { token, setCookie } = await getCsrf(authCookies);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const csrfCookie = (setCookie || []).find((c) => c.includes('x-csrf-token='));
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).toMatch(/HttpOnly/i);
    expect(csrfCookie).toMatch(/SameSite=Strict/i);
  });

  test('the token response is never cached', async () => {
    const res = await request(app).get('/api/csrf-token');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('re-fetching the token in the same session returns the same token', async () => {
    const { token, cookies } = await loggedInSession();
    const again = await getCsrf(cookies);
    expect(again.token).toBe(token);
  });
});

describe('legitimate requests with a valid token', () => {
  test('the owner can update and delete their own request', async () => {
    const session = await loggedInSession();
    const created = await fileRequest(session, 'Window will not close');

    const patched = await request(app)
      .patch(`/api/maintenance/${created._id}`)
      .set('Cookie', cookieHeader(session.cookies))
      .set('x-csrf-token', session.token)
      .send({ status: 'in_progress' });
    expect(patched.status).toBe(200);
    expect(patched.body.request.status).toBe('in_progress');

    const deleted = await request(app)
      .delete(`/api/maintenance/${created._id}`)
      .set('Cookie', cookieHeader(session.cookies))
      .set('x-csrf-token', session.token);
    expect(deleted.status).toBe(200);
    expect(await findByDescription('Window will not close')).toBeUndefined();
  });

  test('ownership checks still apply after the CSRF check passes', async () => {
    const owner = await loggedInSession();
    const created = await fileRequest(owner, 'Owner only');
    const other = await loggedInSession();

    const res = await request(app)
      .delete(`/api/maintenance/${created._id}`)
      .set('Cookie', cookieHeader(other.cookies))
      .set('x-csrf-token', other.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBeUndefined(); // an ownership 403, not a CSRF 403
    expect(await findByDescription('Owner only')).toBeDefined();
  });
});

describe('forged / invalid requests are rejected with 403 and change nothing', () => {
  test('a forged HTML form POST (urlencoded, cookie only) is rejected', async () => {
    const { authCookies } = await registerUser();

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookieHeader(authCookies))
      .set('Origin', 'http://localhost:1337')
      .type('form')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Forged form post' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EBADCSRFTOKEN');
    expect(await findByDescription('Forged form post')).toBeUndefined();
  });

  test('a token placed in the request body instead of the header is not accepted', async () => {
    const { cookies, token } = await loggedInSession();

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookieHeader(cookies))
      .type('form')
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Token in body', _csrf: token, 'x-csrf-token': token });

    expect(res.status).toBe(403);
    expect(await findByDescription('Token in body')).toBeUndefined();
  });

  test('PATCH and DELETE without a token are rejected and the data is unchanged', async () => {
    const session = await loggedInSession();
    const created = await fileRequest(session, 'Leaky radiator');

    const patched = await request(app)
      .patch(`/api/maintenance/${created._id}`)
      .set('Cookie', cookieHeader(session.cookies))
      .send({ status: 'resolved' });
    expect(patched.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/maintenance/${created._id}`)
      .set('Cookie', cookieHeader(session.cookies));
    expect(deleted.status).toBe(403);

    const stillThere = await findByDescription('Leaky radiator');
    expect(stillThere).toBeDefined();
    expect(stillThere.status).toBe('open');
  });

  test('a header token without the matching CSRF cookie is rejected', async () => {
    const { authCookies, token } = await loggedInSession();

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookieHeader(authCookies)) // auth cookie only, CSRF cookie missing
      .set('x-csrf-token', token)
      .send({ roomNumber: 'A1-001', category: 'other', description: 'No csrf cookie' });

    expect(res.status).toBe(403);
    expect(await findByDescription('No csrf cookie')).toBeUndefined();
  });

  test('a header token that does not match the cookie is rejected', async () => {
    const { cookies, token } = await loggedInSession();
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookieHeader(cookies))
      .set('x-csrf-token', tampered)
      .send({ roomNumber: 'A1-001', category: 'other', description: 'Tampered token' });

    expect(res.status).toBe(403);
    expect(await findByDescription('Tampered token')).toBeUndefined();
  });

  test("a token issued for another user's session is rejected", async () => {
    const attacker = await loggedInSession();
    const victim = await registerUser();

    // The attacker plants their own valid token + CSRF cookie next to the victim's auth cookie.
    const attackerCsrfCookie = attacker.cookies.filter((c) => c.includes('x-csrf-token='));
    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookieHeader([...victim.authCookies, ...attackerCsrfCookie]))
      .set('x-csrf-token', attacker.token)
      .send({ roomNumber: 'Z9-666', category: 'other', description: 'Cross-session token' });

    expect(res.status).toBe(403);
    expect(await findByDescription('Cross-session token')).toBeUndefined();
  });

  test('a token issued before login is rejected after login, and a fresh one works', async () => {
    const anon = await getCsrf([]); // token bound to "no session"
    const { authCookies } = await registerUser();
    const anonCsrfCookie = anon.cookies.filter((c) => c.includes('x-csrf-token='));

    const stale = await request(app)
      .post('/api/maintenance')
      .set('Cookie', cookieHeader([...authCookies, ...anonCsrfCookie]))
      .set('x-csrf-token', anon.token)
      .send({ roomNumber: 'A1-002', category: 'other', description: 'Pre-login token' });
    expect(stale.status).toBe(403);

    // Re-fetching with the stale cookie present issues a new, session-bound token.
    const fresh = await getCsrf([...authCookies, ...anonCsrfCookie]);
    expect(fresh.token).not.toBe(anon.token);
    // The browser replaces the stale CSRF cookie with the newly issued one.
    const freshCookies = [...authCookies, ...cookiePairs(fresh.setCookie)];
    await fileRequest({ cookies: freshCookies, token: fresh.token }, 'Post-login token');
  });
});

describe('exempt and protected routes', () => {
  test('safe GET requests work without any token', async () => {
    const { authCookies } = await registerUser();
    expect((await request(app).get('/api/maintenance')).status).toBe(200);
    expect((await request(app).get('/api/bookings')).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookieHeader(authCookies))).status).toBe(200);
  });

  test('pre-auth login and register do not require a token', async () => {
    const { email } = await registerUser(); // register succeeded without a token
    const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
    expect(res.status).toBe(200);
  });

  test('other state-changing routes (bookings, users, logout) are protected too', async () => {
    const session = await loggedInSession();
    const booking = { roomNumber: 'D4-404', startDate: '2030-01-01', endDate: '2030-01-05' };

    const noTokenBooking = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookieHeader(session.authCookies))
      .send(booking);
    expect(noTokenBooking.status).toBe(403);

    const withTokenBooking = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookieHeader(session.cookies))
      .set('x-csrf-token', session.token)
      .send(booking);
    expect(withTokenBooking.status).toBe(201);

    const noTokenUserEdit = await request(app)
      .patch(`/api/users/${session.user.id}`)
      .set('Cookie', cookieHeader(session.authCookies))
      .send({ name: 'Hijacked' });
    expect(noTokenUserEdit.status).toBe(403);

    const noTokenLogout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(session.authCookies));
    expect(noTokenLogout.status).toBe(403);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(session.cookies))
      .set('x-csrf-token', session.token);
    expect(logout.status).toBe(200);
  });
});
