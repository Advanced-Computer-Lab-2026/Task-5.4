/** @jest-environment jsdom */

import { api } from './api.js';

describe('API CSRF request interceptor', () => {
  const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;

  beforeEach(() => {
    document.cookie = 'csrfToken=test-token; path=/';
  });

  test('attaches the CSRF cookie value to mutating requests', () => {
    const config = requestInterceptor({ method: 'post', headers: {} });

    expect(config.headers['X-CSRF-Token']).toBe('test-token');
  });

  test('does not attach a CSRF token to safe GET requests', () => {
    const config = requestInterceptor({ method: 'get', headers: {} });

    expect(config.headers['X-CSRF-Token']).toBeUndefined();
  });
});
