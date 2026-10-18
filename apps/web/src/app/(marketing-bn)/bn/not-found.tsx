import Link from 'next/link';

export default function BanglaNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">পেজটি পাওয়া যায়নি</h1>
      <p className="mt-3 text-[var(--color-muted)]">আপনি যে পেজটি খুঁজছেন সেটি নেই বা আর পাওয়া যাচ্ছে না।</p>
      <p className="mt-6">
        <Link href="/bn" className="font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline">
          হোমপেজে যান
        </Link>
      </p>
    </div>
  );
}
