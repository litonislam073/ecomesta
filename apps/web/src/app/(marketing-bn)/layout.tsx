import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ROOT_FONT_CLASSES } from '@/lib/fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Ecomesta',
    template: '%s | Ecomesta',
  },
  description: 'বাংলাদেশের ব্যবসার জন্য ই-কমার্স প্ল্যাটফর্ম — অনলাইন স্টোর, পেমেন্ট আর ডেলিভারি।',
};

/** Root layout for the Bangla marketing pages under /bn: the server sends `<html lang="bn">`. */
export default function BanglaRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={ROOT_FONT_CLASSES}>
      <body className="min-h-screen text-[var(--color-ink)] antialiased">{children}</body>
    </html>
  );
}
