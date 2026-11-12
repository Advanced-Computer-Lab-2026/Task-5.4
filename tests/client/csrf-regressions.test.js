import { api } from '../../client/src/api.js';

let sent;
let tokenFetches;
let token;

beforeEach(() => {
  sent = [];
  tokenFetches = 0;
  token = 'first-session-token';
  api.defaults.adapter = async config => {
    if (config.url === '/csrf-token') {
      tokenFetches++;
      return { data: { csrfToken: token }, status: 200, statusText: 'OK', headers: {}, config };
    }
    sent.push(config);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
});

test('safe reads and pre-authentication requests do not fetch a CSRF token', async () => {
  await api.get('/maintenance');
  await api.head('/maintenance');
  await api.options('/maintenance');
  await api.post('/auth/login', {});
  await api.post('/auth/register', {});
  expect(tokenFetches).toBe(0);
});

test('POST, PUT, PATCH, DELETE and logout carry a CSRF token', async () => {
  await api.post('/maintenance', {});
  await api.put('/maintenance/123', {});
  await api.patch('/maintenance/123', {});
  await api.delete('/maintenance/123');
  await api.post('/auth/logout');
  expect(sent).toHaveLength(5);
  for (const config of sent) {
    expect(config.headers.get('x-csrf-token')).toBe(token);
  }
});

test('a subsequent write fetches the token for the current session', async () => {
  await api.post('/maintenance', {});
  token = 'new-session-token';
  await api.post('/maintenance', {});
  expect(sent[0].headers.get('x-csrf-token')).toBe('first-session-token');
  expect(sent[1].headers.get('x-csrf-token')).toBe('new-session-token');
});

test('simultaneous writes share the initial CSRF token fetch', async () => {
  await Promise.all([api.post('/maintenance', {}), api.patch('/maintenance/123', {})]);
  expect(tokenFetches).toBe(1);
  expect(sent).toHaveLength(2);
  expect(sent.every(config => config.headers.get('x-csrf-token') === token)).toBe(true);
});
