'use client';

import { useEffect } from 'react';

/**
 * The root layout renders `<html lang="en">` for every page (reading the request there
 * would make every page dynamic). Bangla pages set the document language here,
 * and put it back when the visitor moves on to an English page.
 */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = lang;
    return () => {
      root.lang = previous === lang ? 'en' : previous;
    };
  }, [lang]);
  return <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(lang)}` }} />;
}
