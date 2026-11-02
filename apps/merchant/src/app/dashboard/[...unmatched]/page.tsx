import { notFound } from 'next/navigation';

/**
 * Catches any /dashboard/* URL that has no page so the 404 renders inside the
 * dashboard layout (see ../not-found.tsx) instead of the app-level 404.
 */
export default function DashboardUnmatchedPage(): never {
  notFound();
}
