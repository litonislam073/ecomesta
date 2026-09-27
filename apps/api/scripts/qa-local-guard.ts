/**
 * Shared by the local QA scripts: the fixed list of QA merchant accounts and
 * the guard that refuses to touch anything but the local development database.
 */

export interface QaAccount {
  email: string;
  /** Tenant/store slug created by onboarding, or null when never onboarded. */
  slug: string | null;
}

export const QA_ACCOUNTS: readonly QaAccount[] = [
  { email: 'onboard-ui-qa-20260928@example.com', slug: 'onboard-qa-shop' },
  { email: 'onboard-conflict-qa-20260928@example.com', slug: null },
  { email: 'auth-ui-qa-20260927@example.com', slug: 'auth-qa-shop' },
  { email: 'billing-qa-growth-20260928@example.com', slug: 'billing-qa-growth' },
  { email: 'billing-qa-starter-20260928@example.com', slug: 'billing-qa-starter' },
  { email: 'billing-qa-business-20260928@example.com', slug: 'billing-qa-business' },
];

const EXPECTED_DATABASE = 'ecomesta';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function fail(message: string): never {
  console.error(`REFUSED: ${message}`);
  process.exit(1);
}

export function checkEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV ?? '(unset)';
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    fail('DATABASE_URL is not set');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail('DATABASE_URL is not a valid URL');
  }
  const database = url.pathname.replace(/^\//, '');

  console.log('Target database');
  console.log(`  host:     ${url.hostname}`);
  console.log(`  port:     ${url.port || '(default)'}`);
  console.log(`  database: ${database}`);
  console.log(`  NODE_ENV: ${nodeEnv}`);

  if (nodeEnv !== 'development') {
    fail('NODE_ENV must be exactly "development"');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    fail(`unexpected protocol ${url.protocol}`);
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    fail(`host "${url.hostname}" is not a local loopback host`);
  }
  if (database !== EXPECTED_DATABASE) {
    fail(`database "${database}" is not "${EXPECTED_DATABASE}"`);
  }
}
