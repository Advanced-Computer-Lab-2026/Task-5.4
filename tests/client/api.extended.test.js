import { api, clearCsrfToken } from '../../client/src/api.js';

// Extended client coverage: when the api client fetches and attaches the CSRF
// token, when it does not, and how it recovers from a stale token.

describe('client api CSRF token handling', () => {
  let sent; // every non-token request, with the header value captured at send time
  let tokenCalls;
  let nextResponse; // optional per-request override: (config) => response | throws

  beforeEach(() => {
    clearCsrfToken();
    sent = [];
    tokenCalls = 0;
    nextResponse = null;
    api.defaults.adapter = async (config) => {
      if ((config.url || '').includes('/csrf-token')) {
        tokenCalls += 1;
        return { data: { csrfToken: `token-${tokenCalls}` }, status: 200, statusText: 'OK', headers: {}, config };
      }
      sent.push({ method: config.method, url: config.url, token: config.headers.get('x-csrf-token') });
      if (nextResponse) return nextResponse(config);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
  });

  function rejectWith(config, status, data) {
    const error = new Error(`Request failed with status code ${status}`);
    error.config = config;
    error.response = { status, data, headers: {}, config };
    throw error;
  }

  test('safe GET requests neither fetch a token nor send the header', async () => {
    await api.get('/maintenance');
    await api.get('/auth/me');
    expect(tokenCalls).toBe(0);
    expect(sent.every((r) => r.token == null)).toBe(true);
  });

  test('pre-auth login and register are sent without a token', async () => {
    await api.post('/auth/login', { email: 'a@b.c', password: 'x' });
    await api.post('/auth/register', { name: 'A', email: 'a@b.c', password: 'x' });
    expect(tokenCalls).toBe(0);
    expect(sent.every((r) => r.token == null)).toBe(true);
  });

  test('POST, PATCH, PUT and DELETE all carry the token', async () => {
    await api.post('/bookings', {});
    await api.patch('/maintenance/1', { status: 'resolved' });
    await api.put('/users/1', {});
    await api.delete('/maintenance/1');
    await api.post('/auth/logout');
    expect(sent.map((r) => r.token)).toEqual(['token-1', 'token-1', 'token-1', 'token-1', 'token-1']);
  });

  test('the token is fetched once and shared, even by concurrent writes', async () => {
    await Promise.all([api.post('/maintenance', {}), api.post('/maintenance', {}), api.delete('/maintenance/2')]);
    await api.patch('/maintenance/3', {});
    expect(tokenCalls).toBe(1);
  });

  test('logging in or out discards the cached token so the next write fetches a new one', async () => {
    await api.post('/maintenance', {});
    await api.post('/auth/login', { email: 'a@b.c', password: 'x' });
    await api.post('/maintenance', {});
    expect(tokenCalls).toBe(2);
    expect(sent.filter((r) => r.url === '/maintenance').map((r) => r.token)).toEqual(['token-1', 'token-2']);

    await api.post('/auth/logout'); // uses token-2, then discards it
    await api.post('/maintenance', {});
    expect(tokenCalls).toBe(3);
  });

  test('a CSRF 403 makes the client fetch a fresh token and retry once', async () => {
    let attempts = 0;
    nextResponse = (config) => {
      attempts += 1;
      if (attempts === 1) rejectWith(config, 403, { message: 'Invalid or missing CSRF token', code: 'EBADCSRFTOKEN' });
      return { data: { ok: true }, status: 201, statusText: 'Created', headers: {}, config };
    };

    const res = await api.post('/maintenance', { description: 'retry me' });
    expect(res.status).toBe(201);
    expect(sent.map((r) => r.token)).toEqual(['token-1', 'token-2']);
  });

  test('the client gives up after one retry if the token is still refused', async () => {
    nextResponse = (config) => rejectWith(config, 403, { message: 'Invalid or missing CSRF token', code: 'EBADCSRFTOKEN' });
    await expect(api.post('/maintenance', {})).rejects.toMatchObject({ response: { status: 403 } });
    expect(sent).toHaveLength(2);
  });

  test('other errors (ownership 403, rate-limit 429) are not retried', async () => {
    nextResponse = (config) => rejectWith(config, 403, { message: 'You can only delete your own requests' });
    await expect(api.delete('/maintenance/9')).rejects.toMatchObject({ response: { status: 403 } });

    nextResponse = (config) => rejectWith(config, 429, { message: 'Too many requests' });
    await expect(api.get('/maintenance')).rejects.toMatchObject({ response: { status: 429 } });

    expect(sent).toHaveLength(2);
  });
});
