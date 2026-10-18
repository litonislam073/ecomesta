import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ROOT_FONT_CLASSES } from '@/lib/fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Ecomesta',
    template: '%s | Ecomesta',
  },
  description:
    'Bangladesh-first ecommerce SaaS — merchant stores, payments, and shipping.',
};

/**
 * Root layout for every English page and every storefront. Bangla marketing pages
 * have their own root layout (app/(marketing-bn)) so the server sends
 * `<html lang="bn">` there instead of fixing it in the browser.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={ROOT_FONT_CLASSES}>
      <body className="min-h-screen text-[var(--color-ink)] antialiased">{children}</body>
    </html>
  );
}
