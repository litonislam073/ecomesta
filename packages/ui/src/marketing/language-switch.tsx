'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { alternateLanguagePath } from './i18n';
import { marketingHref } from './nav';

/**
 * "বাংলা" on an English page that has a Bangla version, "English" on a Bangla
 * page. Hidden on pages that exist in one language only.
 */
export function LanguageSwitch({ siteOrigin = '', className = '' }: { siteOrigin?: string; className?: string }) {
  const pathname = usePathname() ?? '/';
  const alternate = alternateLanguagePath(pathname);
  if (!alternate) return null;
  const toBangla = alternate.locale === 'bn';
  return (
    <Link
      href={marketingHref(siteOrigin, alternate.href)}
      hrefLang={toBangla ? 'bn' : 'en'}
      lang={toBangla ? 'bn' : 'en'}
      aria-label={toBangla ? 'এই পেজটি বাংলায় পড়ুন (Read in Bangla)' : 'Read this page in English (ইংরেজিতে পড়ুন)'}
      data-cta={toBangla ? 'language-bn' : 'language-en'}
      className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      {toBangla ? 'বাংলা' : 'English'}
    </Link>
  );
}
