import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  Anek_Bangla,
  Baloo_Da_2,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  Fraunces,
  Hind_Siliguri,
  Noto_Serif_Bengali,
  Source_Sans_3,
  Tiro_Bangla,
} from 'next/font/google';
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

// Landing page template fonts. Not preloaded: only landing pages that use them download them.
const tiroBangla = Tiro_Bangla({
  subsets: ['bengali', 'latin'],
  weight: '400',
  variable: '--font-tiro-bangla',
  display: 'swap',
  preload: false,
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
  preload: false,
});

const balooDa = Baloo_Da_2({
  subsets: ['bengali', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-baloo-da',
  display: 'swap',
  preload: false,
});

const anekBangla = Anek_Bangla({
  subsets: ['bengali', 'latin'],
  weight: ['600', '800'],
  variable: '--font-anek-bangla',
  display: 'swap',
  preload: false,
});

const notoSerifBengali = Noto_Serif_Bengali({
  subsets: ['bengali', 'latin'],
  weight: ['400', '600'],
  variable: '--font-noto-serif-bengali',
  display: 'swap',
  preload: false,
});

const landingFonts = [tiroBangla, cormorant, balooDa, anekBangla, notoSerifBengali].map((font) => font.variable).join(' ');

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
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable} ${bricolage.variable} ${hindSiliguri.variable} ${landingFonts}`}>
      <body className="min-h-screen text-[var(--color-ink)] antialiased">{children}</body>
    </html>
  );
}
