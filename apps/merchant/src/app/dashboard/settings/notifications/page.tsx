import { Card } from '@/components/ui/card';
import { SettingsHeader } from '@/components/settings/settings-ui';

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Notifications"
        description="Email notifications for you and your customers."
      />
      <Card title="Account emails">
        <p className="text-sm text-[var(--color-muted)]">
          Ecomesta emails your account address about your account and security: your welcome
          message, email confirmation, new stores, password reset links and password changes.
          These emails can&apos;t be turned off.
        </p>
      </Card>
      <Card title="Order notifications">
        <p className="text-sm text-[var(--color-muted)]">
          Order emails for you and your customers are not available yet. New orders appear in
          your dashboard and customers follow their order on the tracking page.
        </p>
      </Card>
    </div>
  );
}
