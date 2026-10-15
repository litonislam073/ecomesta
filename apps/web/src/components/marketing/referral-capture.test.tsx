import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ReferralCapture, readReferralCookie, sharedCookieDomain, withReferral } from './referral-capture';

describe('referral capture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'ecomesta_ref=; max-age=0; path=/';
    window.history.replaceState(null, '', '/');
  });

  it('finds the domain the website and the merchant app share', () => {
    expect(sharedCookieDomain('www.ecomesta.com', 'app.ecomesta.com')).toBe('ecomesta.com');
    expect(sharedCookieDomain('ecomesta.com', 'merchant.ecomesta.com')).toBe('ecomesta.com');
    expect(sharedCookieDomain('localhost', 'localhost')).toBeNull();
    expect(sharedCookieDomain('ecomesta.com', 'ecomesta.app')).toBeNull();
  });

  it('reads only valid codes from the cookie', () => {
    expect(readReferralCookie('a=1; ecomesta_ref=rahim4821')).toBe('RAHIM4821');
    expect(readReferralCookie('ecomesta_ref=%3Cscript%3E')).toBeNull();
    expect(readReferralCookie('')).toBeNull();
  });

  it('adds the code to links into merchant sign-up only', () => {
    const app = 'https://app.ecomesta.com';
    expect(withReferral('https://app.ecomesta.com/register?plan=growth', 'RAHIM4821', app)).toBe(
      'https://app.ecomesta.com/register?plan=growth&ref=RAHIM4821',
    );
    expect(withReferral('https://app.ecomesta.com/login', 'RAHIM4821', app)).toBe('https://app.ecomesta.com/login');
    expect(withReferral('https://evil.example/register', 'RAHIM4821', app)).toBe('https://evil.example/register');
  });

  it('counts the visit and remembers a valid ?ref for the program window', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { valid: true, cookieDays: 30 } }) });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/?ref=rahim4821');
    render(<ReferralCapture />);
    await waitFor(() => expect(readReferralCookie(document.cookie)).toBe('RAHIM4821'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/public\/affiliate\/click$/),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'RAHIM4821' }) }),
    );
  });

  it('does not remember a code the API does not recognise', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { valid: false, cookieDays: 30 } }) });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/?ref=NOPE0000');
    render(<ReferralCapture />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(readReferralCookie(document.cookie)).toBeNull();
  });
});
