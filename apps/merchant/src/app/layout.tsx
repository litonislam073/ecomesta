import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Source_Sans_3 } from 'next/font/google';
import { AppProviders } from '@/components/providers';
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
  title: 'Ecomesta Merchant',
  description: 'Merchant dashboard for managing Ecomesta stores',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
