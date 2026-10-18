import { notFound } from 'next/navigation';

/** Unknown /bn/... paths get the Bangla not-found page instead of the English one. */
export default function BanglaMissingPage() {
  notFound();
}
