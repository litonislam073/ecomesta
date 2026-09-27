# Database backups

## Scope

- **Authoritative data** lives in Postgres. Use `scripts/backup-postgres.sh` / `scripts/restore-postgres.sh`.
- Redis AOF/RDB is **not** a substitute for database backups (sessions/rate-limits/cache only).

## Scripts

```bash
# Backup (reads DATABASE_URL or PG* vars — no hardcoded passwords)
export DATABASE_URL='postgresql://…'
./scripts/backup-postgres.sh
# → backups/ecomesta-postgres-<UTC>.sql.gz

# Non-destructive drill: restore into a NEW database
RESTORE_DB=ecomesta_restore_drill ./scripts/restore-postgres.sh backups/ecomesta-postgres-….sql.gz

# Restore into the configured (empty) database — requires explicit confirmation
CONFIRM=yes ./scripts/restore-postgres.sh backups/ecomesta-postgres-….sql.gz
```

On the VPS use `BACKUP_MODE=compose` (runs inside the Postgres container).
`BACKUP_RETENTION_DAYS` (default 14) prunes old dumps. Cron, off-host copies,
RPO/RTO and the disaster-recovery procedure are in `docs/deployment.md` §12–§13.

Both scripts refuse to embed credentials; supply them via environment or a secrets manager.

## RPO / RTO guidance

| Metric | Suggested starting target | Notes |
| --- | --- | --- |
| RPO (max data loss) | ≤ 24h (better: ≤ 1h with frequent dumps or WAL archiving) | Schedule dumps via cron or managed snapshots |
| RTO (time to restore) | ≤ 4h for a single region restore | Practice restores quarterly |

Tighten RPO with continuous WAL archiving (e.g. managed Postgres PITR) when order/payment volume warrants it.

## Retention

- Keep daily dumps ≥ 7 days, weekly ≥ 4 weeks, monthly ≥ 3 months (adjust for compliance).
- Store backups **off-host** (object storage) with encryption at rest and access controls.
- Do not leave dumps on the API container filesystem long-term.

## Verification

1. `gunzip -t` every dump after creation.
2. Periodically restore into a disposable database and run `prisma migrate status` + smoke queries.
3. Alert on backup job failure.

## Redis note

Redis persistence (AOF) survives process restarts but is **not** a DB backup. Do not rely on Redis for order, payment, or tenant recovery.
