import { AppShell, Button } from '@ecomesta/ui';

export default function AdminHomePage() {
  return (
    <AppShell
      brand="Ecomesta Admin"
      title="Platform control"
      description="Super Admin surface for tenants, subscriptions, and platform health. Full tooling arrives in later phases."
    >
      <Button variant="ghost">Review platform later</Button>
    </AppShell>
  );
}
