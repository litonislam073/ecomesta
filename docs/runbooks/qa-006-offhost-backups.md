# Runbook: off-host copies for Ecomesta Postgres backups (QA-006)

**Status: NOT COMPLETED — EXTERNAL DEPENDENCY.** Daily local backups and the
weekly restore check are running on the VPS. Off-host copies are not, because
no storage destination or credentials exist yet. Every run currently logs
`OFF-HOST NOT CONFIGURED` and writes `offhost_status=not_configured` to
`/opt/ecomesta/backups/last-run.status`.

This runbook lists exactly what is needed and how to switch it on. It does not
choose a provider.

## What is already in place on the VPS

| Item | Location |
|---|---|
| Daily backup, 03:17 host time | `/etc/cron.d/ecomesta-backup` → `/opt/ecomesta/scripts/backup-scheduled.sh` |
| Weekly restore check, Sunday 04:47 | same cron file → `scripts/verify-backup-restore.sh` |
| Settings (root, 0600) | `/etc/ecomesta/backup.env` (`BACKUP_OFFHOST_METHOD=` is empty) |
| Dumps (root, 0700 / files 0600) | `/opt/ecomesta/backups/` — 14 days, never fewer than the newest 3 |
| Log | `/var/log/ecomesta-backup.log` (logrotate: weekly, 8 kept) |
| Tools already installed | `rsync 3.2.7`, `restic 0.16.4`, `OpenSSH 9.6` |

Dumps are about 60 KB today (logical `pg_dump`, gzip).

## Choose one method

| | `rsync` over SSH | `restic` |
|---|---|---|
| Destination | Another Linux server you control | S3-compatible storage, Backblaze B2, SFTP, and other restic backends |
| Encryption at rest | Only whatever the target disk provides | Yes (restic encrypts with the repository password) |
| Retention on the destination | **Not handled by Ecomesta** — the target must prune (see below) | Handled: `forget --prune` keeps 14 daily / 8 weekly / 6 monthly |
| Credentials you must supply | SSH user + host + path on the target | Repository URL, provider access keys, a repository password |

---

## Option A — rsync over SSH

### You must provide
1. A server that is **not** this VPS (different provider or region preferred).
2. On it, a dedicated user (e.g. `ecomesta-backup`) and a directory
   (e.g. `/srv/backups/ecomesta`) owned by that user, mode `0700`.
3. The target's SSH host key fingerprint, obtained out-of-band.

### Steps on the Ecomesta VPS (root)
```bash
ssh-keygen -t ed25519 -N '' -C ecomesta-backup -f /root/.ssh/ecomesta_backup_ed25519
cat /root/.ssh/ecomesta_backup_ed25519.pub      # give this to the target admin
ssh-keyscan -t ed25519 <target-host> >> /root/.ssh/known_hosts
ssh-keygen -lf /root/.ssh/known_hosts -F <target-host>   # compare with the fingerprint from step 3
```

### Steps on the target (its admin)
Add the public key to `~ecomesta-backup/.ssh/authorized_keys`, restricted:
```
restrict,command="rrsync -wo /srv/backups/ecomesta" ssh-ed25519 AAAA… ecomesta-backup
```
`rrsync` (shipped with rsync ≥ 3.2) limits the key to write-only rsync into
that directory. With `rrsync`, paths are relative to the restricted directory,
so use `BACKUP_OFFHOST_TARGET=ecomesta-backup@<target-host>:` in the settings
below. Without `rrsync`, use the absolute path and a plain `restrict` key.

> **Untested combination:** `backup-scheduled.sh` sends to
> `${BACKUP_OFFHOST_TARGET%/}/`, i.e. `…@<target-host>:/` in the `rrsync` case.
> How `rrsync` maps that `/` has not been tested against a real target. The
> acceptance test below will show it; if it fails, use the plain `restrict` key
> with the absolute path instead.

Retention on the target (Ecomesta does not delete remote files) — e.g. a daily
cron on the target:
```bash
find /srv/backups/ecomesta -name 'ecomesta-postgres-*.sql.gz' -mtime +35 -delete
```

### Settings — edit `/etc/ecomesta/backup.env`
```bash
BACKUP_OFFHOST_METHOD=rsync
BACKUP_OFFHOST_TARGET=ecomesta-backup@<target-host>:          # or …:/srv/backups/ecomesta without rrsync
BACKUP_OFFHOST_SSH_KEY=/root/.ssh/ecomesta_backup_ed25519
```

---

## Option B — restic

### You must provide
1. A restic repository URL, for example
   `s3:https://<endpoint>/<bucket>/ecomesta`, `b2:<bucket>:ecomesta`, or
   `sftp:<user>@<host>:/srv/restic/ecomesta`.
2. The provider credentials restic needs for that backend (for S3-compatible:
   `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`; for B2: `B2_ACCOUNT_ID` and
   `B2_ACCOUNT_KEY`). Use a key limited to that bucket.
3. A repository password. **Store a copy outside this VPS** (password
   manager). Without it the backups cannot be decrypted by anyone.

### Steps on the Ecomesta VPS (root)
```bash
install -m 600 /dev/null /etc/ecomesta/restic-password
openssl rand -base64 32 > /etc/ecomesta/restic-password     # or paste your own
```
Edit `/etc/ecomesta/backup.env`:
```bash
BACKUP_OFFHOST_METHOD=restic
RESTIC_REPOSITORY=<repository URL>
RESTIC_PASSWORD_FILE=/etc/ecomesta/restic-password
AWS_ACCESS_KEY_ID=<key id>            # or the variables your backend needs
AWS_SECRET_ACCESS_KEY=<secret>
BACKUP_OFFHOST_KEEP_DAILY=14
BACKUP_OFFHOST_KEEP_WEEKLY=8
BACKUP_OFFHOST_KEEP_MONTHLY=6
```
Initialise the repository once:
```bash
( set -a; . /etc/ecomesta/backup.env; set +a; restic init )
```
Expected: `created restic repository <id> at <repository URL>`.

---

## Acceptance test (either method)

```bash
stat -c '%a %U' /etc/ecomesta/backup.env          # expect: 600 root
/opt/ecomesta/scripts/backup-scheduled.sh; echo "exit=$?"
cat /opt/ecomesta/backups/last-run.status
tail -n 5 /var/log/ecomesta-backup.log
```
Expected:
```
exit=0
finished_at=<UTC time>
local_status=ok
offhost_status=ok
dump=/opt/ecomesta/backups/ecomesta-postgres-<stamp>.sql.gz
... off-host rsync OK → …            (or: off-host restic OK → s3:…)
```
`exit=2` with `offhost_status=failed` means the local dump is fine but the
copy failed; the log names the step.

**Prove the off-host copy restores** (a copy that was never restored does not
count):

- rsync: on a machine with Postgres tools, copy the newest file back from the
  target and run
  `BACKUP_MODE=direct DATABASE_URL=<disposable db URL> scripts/verify-backup-restore.sh <file>`.
- restic, on the VPS:
  ```bash
  ( set -a; . /etc/ecomesta/backup.env; set +a
    restic snapshots --tag ecomesta-postgres
    rm -rf /root/restic-restore-test
    restic restore latest --tag ecomesta-postgres --target /root/restic-restore-test )
  f=$(find /root/restic-restore-test -name 'ecomesta-postgres-*.sql.gz' | sort | tail -n 1)
  cd /opt/ecomesta && BACKUP_MODE=compose scripts/verify-backup-restore.sh "$f"
  rm -rf /root/restic-restore-test
  ```
  Expected: `RESTORE CHECK PASSED` and `dropped ecomesta_restore_check_…`.

Only after both checks pass may QA-006 be marked complete.

## Monitoring

Alert when either of these is true:
- `/opt/ecomesta/backups/last-run.status` is older than 26 hours;
- it contains anything other than `local_status=ok` and `offhost_status=ok`.

Nothing currently sends this alert; it must be wired to whatever monitoring the
operator uses.
