import { Card } from '@/components/ui/card';
import { Button } from '@ecomesta/ui';
import Link from 'next/link';

export function ComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">{description}</p>
      </div>
      <Card title="Coming in a later phase">
        <p className="text-sm text-[var(--color-muted)]">
          This section is reserved in the navigation so the merchant shell is ready.
          Backend APIs for this area are not wired into the dashboard yet.
        </p>
        <div className="mt-4">
          <Link href="/dashboard">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
