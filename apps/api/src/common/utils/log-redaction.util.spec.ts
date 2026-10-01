import { redactRequestForLog, redactUrlQuery } from './log-redaction.util';

describe('request log redaction', () => {
  it('hides search terms in logged URLs and keeps everything else', () => {
    expect(redactUrlQuery('/api/v1/admin/support-chats?search=01711000000&page=2')).toBe(
      '/api/v1/admin/support-chats?search=[Redacted]&page=2',
    );
    expect(redactUrlQuery('/api/v1/admin/users?page=1&search=rahim%40example.com')).toBe(
      '/api/v1/admin/users?page=1&search=[Redacted]',
    );
    expect(redactUrlQuery('/api/v1/health')).toBe('/api/v1/health');
    expect(redactUrlQuery('/api/v1/public/stores/a/products?store=a&category=shoes')).toBe(
      '/api/v1/public/stores/a/products?store=a&category=shoes',
    );
  });

  it('hides the search value in the logged query object', () => {
    const req = redactRequestForLog({
      url: '/api/v1/admin/support-chats?search=nadia%40example.com',
      query: { search: 'nadia@example.com', page: '1' },
    });
    expect(req).toEqual({
      url: '/api/v1/admin/support-chats?search=[Redacted]',
      query: { search: '[Redacted]', page: '1' },
    });
  });
});
