import { escapeHtml, safeSubject } from './layout';
import {
  emailVerificationEmail,
  passwordChangedEmail,
  passwordResetEmail,
  storeCreatedEmail,
  supportRequestEmail,
  welcomeEmail,
} from './templates';

const brand = {
  logoUrl: 'https://ecomesta.com/brand/ecomesta-logo.png',
  appUrl: 'https://ecomesta.com',
  merchantUrl: 'https://merchant.ecomesta.com',
  supportEmail: 'support@ecomesta.com',
};

describe('email templates', () => {
  it('wraps every email in the branded layout with logo, support contact and footer', () => {
    const email = welcomeEmail({ firstName: 'Ada' }, brand, null);
    expect(email.subject).toBe('Welcome to Ecomesta');
    expect(email.html).toContain('src="https://ecomesta.com/brand/ecomesta-logo.png"');
    expect(email.html).toContain('mailto:support@ecomesta.com');
    expect(email.html).toMatch(/&copy; \d{4} Ecomesta/);
    expect(email.html).toContain('Go to Your Dashboard');
    expect(email.html).toContain('href="https://merchant.ecomesta.com/dashboard"');
    expect(email.html).toContain('max-width: 600px');
    expect(email.html).not.toMatch(/<script/i);
    expect(email.text).toContain('Go to Your Dashboard: https://merchant.ecomesta.com/dashboard');
    expect(email.text).toContain('support@ecomesta.com');
  });

  it('omits the support line when no support address is configured', () => {
    const email = welcomeEmail({ firstName: null }, { ...brand, supportEmail: null }, null);
    expect(email.html).not.toContain('mailto:');
    expect(email.html).toContain('Hi,');
  });

  it('adds a verification link to the welcome email only when provided', () => {
    const url = 'https://merchant.ecomesta.com/verify-email#token=abc';
    expect(welcomeEmail({ firstName: 'Ada' }, brand, { url, expiresInHours: 48 }).html).toContain(
      'Confirm email address',
    );
    expect(welcomeEmail({ firstName: 'Ada' }, brand, null).html).not.toContain('verify-email');
  });

  it('escapes merchant-controlled values and strips header injection from subjects', () => {
    const email = storeCreatedEmail(
      {
        firstName: '<img src=x onerror=alert(1)>',
        storeName: 'Evil <b>Store</b>\r\nBcc: victim@example.com',
        storeSlug: 'evil-store',
        planName: null,
        billingCycle: null,
        trialEndsAt: null,
      },
      brand,
      'https://evil-store.ecomesta.com',
    );
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(email.html).not.toContain('<b>Store</b>');
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.subject).toBe('Your store Evil <b>Store</b> Bcc: victim@example.com is ready');
  });

  it('lists store, store URL, dashboard, plan and trial on the store-created email', () => {
    const email = storeCreatedEmail(
      {
        firstName: 'Ada',
        storeName: 'Demo Store',
        storeSlug: 'demo-store',
        planName: 'Starter',
        billingCycle: 'MONTHLY',
        trialEndsAt: '2026-11-28T00:00:00.000Z',
      },
      brand,
      'https://demo-store.ecomesta.com',
    );
    expect(email.subject).toBe('Your store Demo Store is ready');
    expect(email.html).toContain('href="https://demo-store.ecomesta.com/"');
    expect(email.text).toContain('Store: Demo Store');
    expect(email.text).toContain('Plan: Starter (Monthly)');
    expect(email.text).toContain('Free trial: Until 28 November 2026');
    expect(email.text).toContain('Dashboard: https://merchant.ecomesta.com/dashboard');
  });

  it('builds the reset email with expiry and the ignore-if-not-you notice', () => {
    const resetUrl = 'https://merchant.ecomesta.com/reset-password#token=T0KEN';
    const email = passwordResetEmail({ firstName: 'Ada', resetUrl, expiresInMinutes: 60 }, brand);
    expect(email.subject).toBe('Reset your Ecomesta password');
    expect(email.html).toContain('Reset Password');
    expect(email.html).toContain(`href="${resetUrl}"`);
    expect(email.text).toContain('expires in 60 minutes');
    expect(email.text).toContain(
      'If you did not request this password reset, you can safely ignore this email.',
    );
  });

  it('builds the password-changed email with timestamp and security notice', () => {
    const email = passwordChangedEmail({ firstName: 'Ada', changedAt: '2026-09-28T10:15:00.000Z' }, brand);
    expect(email.subject).toBe('Your Ecomesta password was changed');
    expect(email.text).toContain('28 September 2026 at 10:15 UTC');
    expect(email.text).toContain('signed out of Ecomesta on all devices');
    expect(email.html).toContain('href="https://merchant.ecomesta.com/login"');
    expect(email.html).toContain('href="https://merchant.ecomesta.com/forgot-password"');
  });

  it('builds the verification email', () => {
    const email = emailVerificationEmail(
      { firstName: 'Ada', verifyUrl: 'https://merchant.ecomesta.com/verify-email#token=x', expiresInHours: 48 },
      brand,
    );
    expect(email.subject).toBe('Confirm your Ecomesta email address');
    expect(email.text).toContain('expires in 48 hours');
  });

  it('builds the support email with the merchant message escaped', () => {
    const email = supportRequestEmail(
      { category: 'Billing', subject: 'Invoice', message: 'Hello <script>x</script>\nLine two', storeName: 'Demo' },
      brand,
      { name: 'Ada L', email: 'ada@example.com', userId: 'u1', tenantId: 't1', storeId: 's1' },
    );
    expect(email.subject).toBe('[Support] Billing: Invoice');
    expect(email.html).not.toContain('<script>x</script>');
    expect(email.html).toContain('Hello &lt;script&gt;x&lt;/script&gt;<br>Line two');
    expect(email.text).toContain('Account email: ada@example.com');
  });

  it('refuses non-http links', () => {
    expect(() =>
      passwordResetEmail({ firstName: null, resetUrl: 'javascript:alert(1)', expiresInMinutes: 60 }, brand),
    ).toThrow();
  });

  it('never includes password fields in any template', () => {
    const all = [
      welcomeEmail({ firstName: 'Ada' }, brand, null),
      passwordChangedEmail({ firstName: 'Ada', changedAt: new Date().toISOString() }, brand),
      passwordResetEmail({ firstName: 'Ada', resetUrl: 'https://m.example/r#token=a', expiresInMinutes: 60 }, brand),
    ];
    for (const email of all) {
      expect(email.html).not.toMatch(/passwordHash|your password is|password:/i);
    }
  });

  it('escapes HTML and bounds subjects', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(safeSubject('a'.repeat(300))).toHaveLength(200);
  });
});
