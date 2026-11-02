import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { contentSecurityPolicy } = require('../../next.config.js') as { contentSecurityPolicy: string };

/**
 * Pins the production CSP from next.config.js so L18 polish does not silently
 * drop frame/script lockdowns.
 */
describe('public site Content-Security-Policy', () => {
  it('locks objects, base URI and framing while allowing GTM/GA/Meta and https images', () => {
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("base-uri 'self'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'self'");
    expect(contentSecurityPolicy).toContain('https://www.googletagmanager.com');
    expect(contentSecurityPolicy).toContain('https://connect.facebook.net');
    expect(contentSecurityPolicy).toContain("img-src 'self' data: blob: https:");
    expect(contentSecurityPolicy).not.toContain('unsafe-eval');
  });
});
