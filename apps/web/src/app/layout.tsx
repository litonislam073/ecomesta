import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Ecomesta Storefront',
    template: '%s · Ecomesta',
  },
  description: 'Public storefront for Ecomesta stores',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable}`}>
      <body className="min-h-screen text-[var(--color-ink)] antialiased">{children}</body>
    </html>
  );
}
