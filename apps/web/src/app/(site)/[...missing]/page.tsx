import { notFound } from 'next/navigation';

/**
 * With two root layouts (English and Bangla) Next has no app-wide not-found page,
 * so any path no route matches lands here and renders (site)/not-found.tsx —
 * including the middleware's internal "marketing page unavailable" rewrite.
 */
export default function MissingPage() {
  notFound();
}
