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
  title: 'Ecomesta Admin',
  description: 'Super Admin console for the Ecomesta platform',
  robots: { index: false, follow: false },
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
