#!/usr/bin/env node
/**
 * Local development only. `next dev` compiles each page the first time it is
 * opened; this opens the main pages once as soon as the dev servers are up, so
 * the first real click is fast. Run it next to `pnpm dev` (pnpm dev:warmup).
 *
 * Store pages are warmed with DEV_WARMUP_STORE (a store slug), or a dummy slug:
 * the page compiles either way.
 */
const HOST = process.env.DEV_WARMUP_HOST || 'http://127.0.0.1';
const STORE = encodeURIComponent(process.env.DEV_WARMUP_STORE || 'warmup');

const APPS = [
  {
    name: 'web',
    port: 3000,
    paths: [
      '/',
      '/pricing',
      '/contact',
      `/?store=${STORE}`,
      `/products?store=${STORE}`,
      `/products/warmup?store=${STORE}`,
      `/categories/warmup?store=${STORE}`,
      `/cart?store=${STORE}`,
      `/checkout?store=${STORE}`,
      `/track-order?store=${STORE}`,
    ],
  },
  {
    name: 'merchant',
    port: 3002,
    paths: [
      '/login',
      '/dashboard',
      '/dashboard/products',
      '/dashboard/products/new',
      '/dashboard/orders',
      '/dashboard/customers',
      '/dashboard/theme',
      '/dashboard/settings',
      '/dashboard/billing',
    ],
  },
  {
    name: 'admin',
    port: 3003,
    paths: ['/login', '/dashboard', '/dashboard/tenants', '/dashboard/stores', '/dashboard/payments', '/dashboard/plans'],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntilUp(base, timeoutMs = 180_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      await fetch(base, { redirect: 'manual' });
      return true;
    } catch {
      await sleep(1000);
    }
  }
  return false;
}

async function warm(app) {
  const base = `${HOST}:${app.port}`;
  if (!(await waitUntilUp(base))) {
    console.log(`[warmup] ${app.name}: not running on ${app.port}, skipped`);
    return;
  }
  const started = Date.now();
  // One page at a time per app: the dev server compiles them one by one anyway.
  for (const path of app.paths) {
    try {
      await fetch(`${base}${path}`, { redirect: 'manual' });
    } catch {
      // A page that fails to render still got compiled; keep going.
    }
  }
  console.log(`[warmup] ${app.name}: ${app.paths.length} pages ready in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

await Promise.all(APPS.map(warm));
