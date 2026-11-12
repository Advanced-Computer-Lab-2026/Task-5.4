import { api } from '../../client/src/api.js';

function getHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()];
}

describe('client API CSRF behavior', () => {
  let captured;

  beforeEach(() => {
    captured = [];
    api.defaults.adapter = async (config) => {
      if ((config.url || '').includes('/csrf-token')) {
        return { data: { csrfToken: 'test-token' }, status: 200, statusText: 'OK', headers: {}, config };
      }
      captured.push(config);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
  });

  test('sends credentials with requests', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  test('attaches a CSRF token to mutations', async () => {
    await api.post('/maintenance', { roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });
    const sent = captured.find((config) => (config.url || '').includes('/maintenance'));
    expect(getHeader(sent.headers, 'x-csrf-token')).toBe('test-token');
  });
});
