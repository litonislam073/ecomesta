'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { registerUrl, siteUrl } from '@/lib/marketing/site';

const POPULAR = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/payments', label: 'Payments' },
  { href: '/shipping', label: 'Shipping' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

/** True on the Ecomesta website itself, false on any merchant storefront host. */
export function isPlatformHost(hostname: string, search: string): boolean {
  let platform: string;
  try {
    platform = new URL(siteUrl()).hostname;
  } catch {
    return false;
  }
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (host !== platform.replace(/^www\./, '')) return false;
  // Local previews of a store use ?store= on the same host.
  return !new URLSearchParams(search).has('store');
}

/**
 * The shared 404 page also serves storefronts, so Ecomesta's own links are only
 * added in the browser once the host is known to be the Ecomesta website.
 */
export function PlatformNotFoundLinks() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(isPlatformHost(window.location.hostname, window.location.search));
  }, []);
  if (!show) return null;
  return (
    <nav aria-label="Popular pages" className="mt-8 border-t border-[var(--color-border)] pt-6">
      <p className="text-sm font-semibold">Popular pages</p>
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {POPULAR.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="inline-block rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <a
        href={registerUrl()}
        data-cta="create-store-404"
        className="mt-6 inline-flex rounded-lg bg-[var(--color-accent)] px-5 py-3 font-semibold text-white"
      >
        Create Your Store
      </a>
    </nav>
  );
}
