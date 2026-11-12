import { api } from '../client/src/api.js';

describe('client CSRF token handling', () => {
  const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;
  const originalGet = api.get;

  afterEach(() => {
    api.get = originalGet;
  });

  test('adds a freshly issued CSRF token to state-changing requests', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { csrfToken: 'issued-token' } });
    const config = await requestInterceptor({ method: 'post', url: '/maintenance', headers: {} });

    expect(api.get).toHaveBeenCalledWith('/csrf-token');
    expect(config.headers['x-csrf-token']).toBe('issued-token');
  });

  test('does not request CSRF tokens for safe reads or pre-authentication routes', async () => {
    api.get = jest.fn();
    const getConfig = { method: 'get', url: '/maintenance', headers: {} };
    const loginConfig = { method: 'post', url: '/auth/login', headers: {} };

    await expect(requestInterceptor(getConfig)).resolves.toBe(getConfig);
    await expect(requestInterceptor(loginConfig)).resolves.toBe(loginConfig);
    expect(api.get).not.toHaveBeenCalled();
  });
});
