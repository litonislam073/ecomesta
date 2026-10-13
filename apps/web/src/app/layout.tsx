import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Fraunces, Hind_Siliguri, Source_Sans_3 } from 'next/font/google';
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

// Theme fonts (Kenakata). Not preloaded: only stores whose theme uses them download them.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  preload: false,
});

const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hind-siliguri',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: 'Ecomesta',
    template: '%s | Ecomesta',
  },
  description:
    'Bangladesh-first ecommerce SaaS — merchant stores, payments, and shipping.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable} ${bricolage.variable} ${hindSiliguri.variable}`}>
      <body className="min-h-screen text-[var(--color-ink)] antialiased">{children}</body>
    </html>
  );
}
