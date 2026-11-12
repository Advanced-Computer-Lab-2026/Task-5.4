import { api } from '../../client/src/api.js';

// Read a header value whether axios stored it as a plain object or an AxiosHeaders.
function getHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()];
}

describe('client api CSRF behavior', () => {
  let captured;

  beforeEach(() => {
    captured = [];
    // Stub the network layer. Answer the CSRF-token request with a known token
    // and record every other outgoing request so we can inspect its headers.
    api.defaults.adapter = async (config) => {
      if ((config.url || '').includes('/csrf-token')) {
        return { data: { csrfToken: 'test-token' }, status: 200, statusText: 'OK', headers: {}, config };
      }
      captured.push(config);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
  });

  test('requests are sent with credentials so the auth cookie rides along', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  // A state-changing request must carry an anti-CSRF token in a header. The
  // attacker's forged request cannot set this header (and cannot read the token),
  // so this is what defeats CSRF. The vulnerable client never attaches it.
  test('a mutating request carries the x-csrf-token header', async () => {
    await api.post('/maintenance', { roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap' });

    const sent = captured.find((c) => (c.url || '').includes('/maintenance'));
    expect(sent).toBeDefined();
    expect(getHeader(sent.headers, 'x-csrf-token')).toBe('test-token');
  });

  test.each(['patch', 'put', 'delete'])('%s requests carry the token', async (method) => {
    await api[method]('/maintenance/123');
    expect(getHeader(captured[0].headers, 'x-csrf-token')).toBe('test-token');
  });

  test.each(['/auth/login', '/auth/register'])('%s remains usable before authentication', async (path) => {
    await api.post(path, {});
    expect(getHeader(captured[0].headers, 'x-csrf-token')).toBeUndefined();
  });

  test('GET requests need no token but logout does', async () => {
    await api.get('/maintenance');
    await api.post('/auth/logout');
    expect(getHeader(captured[0].headers, 'x-csrf-token')).toBeUndefined();
    expect(getHeader(captured[1].headers, 'x-csrf-token')).toBe('test-token');
  });

  test('a token fetch failure prevents the write and a later attempt can recover', async () => {
    const adapter = api.defaults.adapter;
    api.defaults.adapter = async () => { throw new Error('Token unavailable'); };
    await expect(api.post('/maintenance', {})).rejects.toThrow('Token unavailable');
    expect(captured).toHaveLength(0);
    api.defaults.adapter = adapter;
    await api.post('/maintenance', {});
    expect(getHeader(captured[0].headers, 'x-csrf-token')).toBe('test-token');
  });
});
