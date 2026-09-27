import { Card } from '@/components/ui/card';
import { SettingsHeader } from '@/components/settings/settings-ui';

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Notifications"
        description="Email notifications for you and your customers."
      />
      <Card title="Email notifications">
        <p className="text-sm text-[var(--color-muted)]">
          Notification infrastructure will be connected when email delivery is enabled.
          Until then, new orders appear in your dashboard and customers follow their order
          on the tracking page.
        </p>
      </Card>
    </div>
  );
}
