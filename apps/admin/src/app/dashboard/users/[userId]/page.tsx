'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminUserDetail, PlatformRole } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { displayName, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

type PendingAction =
  | { kind: 'status'; status: 'ACTIVE' | 'SUSPENDED' }
  | { kind: 'platformRole'; platformRole: PlatformRole };

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { pushToast } = useToast();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleDraft, setRoleDraft] = useState<PlatformRole>('USER');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: AdminUserDetail }>(
        `/admin/users/${userId}`,
      );
      setUser(result.data);
      setRoleDraft(result.data.platformRole);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load user'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runPending() {
    if (!pending || !userId) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.kind === 'status') {
        await api.patch(`/admin/users/${userId}/status`, {
          status: pending.status,
        });
        pushToast(
          pending.status === 'SUSPENDED' ? 'User suspended' : 'User activated',
          'success',
        );
      } else {
        await api.patch(`/admin/users/${userId}/platform-role`, {
          platformRole: pending.platformRole,
        });
        pushToast(`Platform role set to ${pending.platformRole}`, 'success');
      }
      setPending(null);
      await load();
    } catch (err) {
      const message = humanApiError(err, 'Could not update the user');
      setActionError(message);
      pushToast(message, 'error');
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const suspended = user?.status === 'SUSPENDED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={user ? displayName(user) : 'User'}
        description={user?.email}
        backHref="/dashboard/users"
        backLabel="Users"
        actions={
          user ? (
            <div className="flex flex-wrap gap-2">
              {suspended ? (
                <Button
                  onClick={() => setPending({ kind: 'status', status: 'ACTIVE' })}
                >
                  Activate user
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setPending({ kind: 'status', status: 'SUSPENDED' })}
                >
                  Suspend user
                </Button>
              )}
            </div>
          ) : null
        }
      />

      {loading ? <LoadingState label="Loading user" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && user ? (
        <>
          {actionError ? <ErrorState message={actionError} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Account">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-[var(--color-muted)]">Status</dt>
                <dd>
                  <StatusBadge status={user.status} />
                </dd>
                <dt className="text-[var(--color-muted)]">Platform role</dt>
                <dd>{user.platformRole}</dd>
                <dt className="text-[var(--color-muted)]">Phone</dt>
                <dd>{user.phone ?? '—'}</dd>
                <dt className="text-[var(--color-muted)]">Email verified</dt>
                <dd>{formatDateTime(user.emailVerifiedAt)}</dd>
                <dt className="text-[var(--color-muted)]">Last login</dt>
                <dd>{formatDateTime(user.lastLoginAt)}</dd>
                <dt className="text-[var(--color-muted)]">Created</dt>
                <dd>{formatDateTime(user.createdAt)}</dd>
              </dl>
            </Card>

            <Card
              title="Platform role"
              description="Super Admin grants full access to this console. The last active Super Admin cannot be demoted."
            >
              <div className="flex flex-wrap items-end gap-2">
                <label className="block flex-1 space-y-1.5" htmlFor="platform-role">
                  <span className="text-sm font-medium">Role</span>
                  <Select
                    id="platform-role"
                    value={roleDraft}
                    onChange={(e) => setRoleDraft(e.target.value as PlatformRole)}
                  >
                    <option value="USER">USER</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </Select>
                </label>
                <Button
                  variant={roleDraft === 'USER' ? 'danger' : 'primary'}
                  disabled={roleDraft === user.platformRole}
                  onClick={() =>
                    setPending({ kind: 'platformRole', platformRole: roleDraft })
                  }
                >
                  Change role
                </Button>
              </div>
            </Card>
          </div>

          <Card title="Tenant memberships">
            {user.tenantMemberships.length === 0 ? (
              <EmptyState title="No tenant memberships" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {user.tenantMemberships.map((membership) => (
                  <li
                    key={membership.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/tenants/${membership.tenant.id}`}
                    >
                      {membership.tenant.name}
                    </Link>
                    <span className="text-[var(--color-muted)]">{membership.role}</span>
                    <StatusBadge status={membership.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Store memberships">
            {user.storeMemberships.length === 0 ? (
              <EmptyState title="No store memberships" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {user.storeMemberships.map((membership) => (
                  <li
                    key={membership.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/stores/${membership.store.id}`}
                    >
                      {membership.store.name}
                    </Link>
                    <span className="text-[var(--color-muted)]">{membership.role}</span>
                    <StatusBadge status={membership.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        danger={
          pending?.kind === 'status'
            ? pending.status === 'SUSPENDED'
            : pending?.platformRole === 'USER'
        }
        title={
          pending?.kind === 'status'
            ? pending.status === 'SUSPENDED'
              ? 'Suspend this user?'
              : 'Activate this user?'
            : pending?.platformRole === 'SUPER_ADMIN'
              ? 'Grant Super Admin?'
              : 'Revoke Super Admin?'
        }
        description={
          pending?.kind === 'status'
            ? pending.status === 'SUSPENDED'
              ? 'The user is signed out of every session and blocked from signing in until reactivated.'
              : 'The user regains access to their tenants and stores.'
            : pending?.platformRole === 'SUPER_ADMIN'
              ? 'This grants unrestricted access to every tenant, store, plan and audit record on the platform.'
              : 'This removes platform-wide access. The last active Super Admin cannot be demoted.'
        }
        confirmLabel={
          pending?.kind === 'status' ? 'Update status' : 'Confirm role change'
        }
        onConfirm={() => void runPending()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
