import { api } from '../../client/src/api.js';
import { AxiosError } from 'axios';

let sent;
let tokenRequests;
function response(config, data = {}) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}
beforeEach(() => {
  sent = [];
  tokenRequests = 0;
  api.defaults.adapter = async config => {
    if (config.url === '/csrf-token') {
      tokenRequests++;
      return response(config, { csrfToken: 'token-' + tokenRequests });
    }
    sent.push(config);
    return response(config);
  };
});

test('safe reads and login/register do not fetch CSRF tokens', async () => {
  await api.get('/maintenance');
  await api.post('/auth/login', {});
  await api.post('/auth/register', {});
  expect(tokenRequests).toBe(0);
});

test('writes fetch afresh across session changes and logout', async () => {
  await api.post('/maintenance', {});
  await api.post('/auth/login', {});
  await api.patch('/users/123', {});
  await api.post('/auth/logout');
  expect(tokenRequests).toBe(3);
  expect(sent[0].headers.get('x-csrf-token')).toBe('token-1');
  expect(sent[2].headers.get('x-csrf-token')).toBe('token-2');
  expect(sent[3].headers.get('x-csrf-token')).toBe('token-3');
});

test('concurrent writes share an in-flight token fetch without recursion', async () => {
  await Promise.all([api.post('/maintenance', {}), api.post('/bookings', {})]);
  expect(tokenRequests).toBe(1);
  expect(sent).toHaveLength(2);
});

test('CSRF failure retries at most once and obtains a fresh token', async () => {
  const adapter = api.defaults.adapter;
  api.defaults.adapter = async config => {
    if (config.url === '/csrf-token') return adapter(config);
    sent.push(config);
    throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, null,
      { ...response(config, { code: 'EBADCSRFTOKEN' }), status: 403 });
  };
  await expect(api.post('/maintenance', {})).rejects.toThrow('Forbidden');
  expect(tokenRequests).toBe(2);
  expect(sent).toHaveLength(2);
});

test('other authorization failures are never replayed', async () => {
  const adapter = api.defaults.adapter;
  api.defaults.adapter = async config => {
    if (config.url === '/csrf-token') return adapter(config);
    sent.push(config);
    throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, null,
      { ...response(config, { message: 'Not your record' }), status: 403 });
  };
  await expect(api.delete('/bookings/123')).rejects.toThrow('Forbidden');
  expect(sent).toHaveLength(1);
});
