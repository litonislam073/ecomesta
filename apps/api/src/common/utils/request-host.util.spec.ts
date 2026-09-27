import express from 'express';
import request from 'supertest';
import {
  clientIp,
  isInternalServiceRequest,
  normalizeHostHeader,
  selectRequestHost,
  trustProxyEnabled,
  trustProxySetting,
} from './request-host.util';

describe('request-host util', () => {
  it('ignores X-Forwarded-Host when trust is disabled', () => {
    expect(
      selectRequestHost({
        hostHeader: 'api.ecomesta.local:3001',
        forwardedHostHeader: 'shop.evil.com',
        trustProxy: false,
      }),
    ).toBe('api.ecomesta.local');
  });

  it('prefers X-Forwarded-Host when trust is enabled', () => {
    expect(
      selectRequestHost({
        hostHeader: 'internal:3001',
        forwardedHostHeader: 'shop.example.com',
        trustProxy: true,
      }),
    ).toBe('shop.example.com');
  });

  it('falls back to Host when trusted but forwarded is missing', () => {
    expect(
      selectRequestHost({
        hostHeader: 'shop.example.com',
        forwardedHostHeader: null,
        trustProxy: true,
      }),
    ).toBe('shop.example.com');
  });

  it('normalizes ports and proxy chains', () => {
    expect(normalizeHostHeader('Shop.Example.COM:443')).toBe('shop.example.com');
    expect(normalizeHostHeader('a.example.com, edge.internal')).toBe(
      'a.example.com',
    );
  });

  it('reads TRUST_PROXY / TRUSTED_PROXY_HOPS', () => {
    expect(trustProxyEnabled({ TRUST_PROXY: 'true' })).toBe(true);
    expect(trustProxyEnabled({ TRUSTED_PROXY_HOPS: '1' })).toBe(true);
    expect(trustProxyEnabled({ TRUST_PROXY: 'false', TRUSTED_PROXY_HOPS: '0' })).toBe(
      false,
    );
    expect(trustProxyEnabled({})).toBe(false);
  });

  it('maps env to an Express trust proxy hop count', () => {
    expect(trustProxySetting({})).toBe(false);
    expect(trustProxySetting({ TRUST_PROXY: 'false', TRUSTED_PROXY_HOPS: '2' })).toBe(
      false,
    );
    expect(trustProxySetting({ TRUST_PROXY: 'true' })).toBe(1);
    expect(trustProxySetting({ TRUST_PROXY: 'true', TRUSTED_PROXY_HOPS: '1' })).toBe(1);
    expect(trustProxySetting({ TRUSTED_PROXY_HOPS: '2' })).toBe(2);
    expect(trustProxySetting({ TRUST_PROXY: 'true', TRUSTED_PROXY_HOPS: 'abc' })).toBe(1);
  });

  describe('clientIp behind Express trust proxy', () => {
    const appWith = (setting: number | false) => {
      const app = express();
      app.set('trust proxy', setting);
      app.get('/ip', (req, res) => {
        res.json({ ip: clientIp(req) });
      });
      return app;
    };

    it('ignores a spoofed X-Forwarded-For when no proxy is trusted', async () => {
      const res = await request(appWith(false))
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.7');
      expect(res.body.ip).not.toBe('203.0.113.7');
      expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
    });

    it('uses the address appended by the single trusted proxy, not the client prefix', async () => {
      // Client sent "X-Forwarded-For: 203.0.113.7"; nginx appended the real peer.
      const res = await request(appWith(1))
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.7, 198.51.100.20');
      expect(res.body.ip).toBe('198.51.100.20');
    });

    it('uses the overwritten header when nginx sets X-Forwarded-For $remote_addr', async () => {
      const res = await request(appWith(1))
        .get('/ip')
        .set('X-Forwarded-For', '198.51.100.20');
      expect(res.body.ip).toBe('198.51.100.20');
    });
  });

  describe('isInternalServiceRequest', () => {
    const req = (
      remoteAddress: string,
      headers: Record<string, string> = {},
      method = 'GET',
    ) => ({ method, headers, socket: { remoteAddress } });

    it('accepts direct GETs from private-network peers behind a trusted proxy', () => {
      for (const address of ['172.18.0.5', '::ffff:10.0.0.4', '192.168.1.2', '127.0.0.1', '::1', 'fd00::5']) {
        expect(isInternalServiceRequest(req(address), true)).toBe(true);
      }
    });

    it('rejects anything that came through nginx', () => {
      expect(
        isInternalServiceRequest(req('172.18.0.2', { 'x-forwarded-for': '203.0.113.7' }), true),
      ).toBe(false);
    });

    it('rejects public peers, writes, and deployments without a trusted proxy', () => {
      expect(isInternalServiceRequest(req('203.0.113.7'), true)).toBe(false);
      expect(isInternalServiceRequest(req('172.32.0.1'), true)).toBe(false);
      expect(isInternalServiceRequest(req('172.18.0.5', {}, 'POST'), true)).toBe(false);
      expect(isInternalServiceRequest(req('172.18.0.5'), false)).toBe(false);
      expect(isInternalServiceRequest({ method: 'GET', headers: {} }, true)).toBe(false);
    });
  });
});
