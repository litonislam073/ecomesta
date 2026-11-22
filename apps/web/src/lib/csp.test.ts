import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { contentSecurityPolicy } = require('../../next.config.js') as { contentSecurityPolicy: string };

/**
 * Pins the production CSP from next.config.js so L18 polish does not silently
 * drop script lockdowns. Framing is owned by nginx (`frame-ancestors` for
 * theme/landing previews), so Next must not emit a competing directive.
 */
describe('public site Content-Security-Policy', () => {
  it('locks objects and base URI while allowing GTM/GA/Meta and https images', () => {
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("base-uri 'self'");
    expect(contentSecurityPolicy).not.toContain('frame-ancestors');
    expect(contentSecurityPolicy).toContain('https://www.googletagmanager.com');
    expect(contentSecurityPolicy).toContain('https://connect.facebook.net');
    expect(contentSecurityPolicy).toContain("img-src 'self' data: blob: https:");
    expect(contentSecurityPolicy).not.toContain('unsafe-eval');
  });
});
