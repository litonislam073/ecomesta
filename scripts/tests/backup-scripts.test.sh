#!/usr/bin/env bash
# Regression tests for the backup tooling (QA-006). Needs pg_dump/psql on PATH
# and DATABASE_URL pointing at a DISPOSABLE database (it is only read, but the
# restore drill creates and drops ecomesta_restore_check_* next to it).
#
#   DATABASE_URL=postgresql://user:pass@localhost:5432/ecomesta_qa_audit \
#     scripts/tests/backup-scripts.test.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL (disposable database) is required}"
export BACKUP_MODE=direct

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
pass=0
fail=0
check() {
  if eval "$2"; then
    pass=$((pass + 1)); echo "  ok   - $1"
  else
    fail=$((fail + 1)); echo "  FAIL - $1"
  fi
}
fresh() { rm -rf "$WORK/out" "$WORK/lock"; mkdir -p "$WORK/out"; }
fake_dump() { # name, age-in-days
  local f="$WORK/out/ecomesta-postgres-$1.sql.gz"
  echo '-- PostgreSQL database dump' | gzip -c >"$f"
  touch -d "$2 days ago" "$f"
}
run_backup() {
  BACKUP_DIR="$WORK/out" "$ROOT_DIR/scripts/backup-postgres.sh" 2>"$WORK/err" | tail -n 1
}
scheduled() {
  BACKUP_CONFIG="$WORK/none.env" BACKUP_DIR="$WORK/out" BACKUP_LOG_FILE="$WORK/backup.log" \
    BACKUP_LOCK_DIR="$WORK/lock" "$ROOT_DIR/scripts/backup-scheduled.sh" "$@" 2>/dev/null
}

echo "1. dump, compression, integrity, permissions"
fresh
dump="$(run_backup)"
check "dump file created" '[[ -f "$dump" ]]'
check "dump is valid gzip" 'gunzip -t "$dump"'
check "dump contains pg_dump header" '(set +o pipefail; gunzip -c "$dump" | head -c 4096 | grep -q "PostgreSQL database dump")'
check "no .partial left behind" '[[ -z "$(find "$WORK/out" -name "*.partial")" ]]'
if [[ "$(uname -s)" == Linux* ]]; then
  check "dump mode is 0600" '[[ "$(stat -c %a "$dump")" == 600 ]]'
  check "backup dir mode is 0700" '[[ "$(stat -c %a "$WORK/out")" == 700 ]]'
else
  echo "  skip - POSIX permission checks (not Linux: $(uname -s))"
fi

echo "2. retention keeps the newest BACKUP_KEEP_MIN even when all are old"
fresh
for d in 01 02 03 04 05; do fake_dump "202601${d}T000000Z" 40; done
BACKUP_RETENTION_DAYS=14 BACKUP_KEEP_MIN=3 run_backup >/dev/null
remaining="$(find "$WORK/out" -name 'ecomesta-postgres-*.sql.gz' | wc -l | tr -d ' ')"
check "3 newest kept (new dump + 2 newest old), 3 oldest removed" '[[ "$remaining" == 3 ]]'
check "newest old dump kept" '[[ -f "$WORK/out/ecomesta-postgres-20260105T000000Z.sql.gz" ]]'
check "oldest dump removed" '[[ ! -f "$WORK/out/ecomesta-postgres-20260101T000000Z.sql.gz" ]]'
fresh
fake_dump 20260101T000000Z 1
BACKUP_RETENTION_DAYS=14 BACKUP_KEEP_MIN=1 run_backup >/dev/null
check "recent dumps are not removed" '[[ -f "$WORK/out/ecomesta-postgres-20260101T000000Z.sql.gz" ]]'

echo "3. insufficient disk space aborts before dumping"
fresh
BACKUP_MIN_FREE_MB=999999999 run_backup >/dev/null; rc=$?
check "exits non-zero" '[[ $rc -ne 0 ]]'
check "explains the reason" 'grep -q "insufficient disk space" "$WORK/err"'
check "creates no dump" '[[ -z "$(find "$WORK/out" -name "*.gz" -o -name "*.partial")" ]]'

echo "4. failed dump leaves nothing and reports failure"
fresh
DATABASE_URL="postgresql://nobody:wrong@127.0.0.1:1/none" scheduled; rc=$?
check "scheduled exit 1 on local failure" '[[ $rc -eq 1 ]]'
check "status file says failed" 'grep -q "^local_status=failed" "$WORK/out/last-run.status"'
check "no partial dump" '[[ -z "$(find "$WORK/out" -name "*.gz" -o -name "*.partial")" ]]'

echo "5. scheduled run without off-host destination"
fresh
scheduled; rc=$?
check "exit 0 when local backup succeeds" '[[ $rc -eq 0 ]]'
check "log warns OFF-HOST NOT CONFIGURED" 'grep -q "OFF-HOST NOT CONFIGURED" "$WORK/backup.log"'
check "status offhost_status=not_configured" 'grep -q "^offhost_status=not_configured" "$WORK/out/last-run.status"'
check "lock released after run" '[[ ! -d "$WORK/lock" ]]'

echo "6. misconfigured off-host fails loudly"
fresh
BACKUP_OFFHOST_METHOD=rsync scheduled; rc=$?
check "exit 2 when rsync target missing" '[[ $rc -eq 2 ]]'
check "status offhost_status=failed" 'grep -q "^offhost_status=failed" "$WORK/out/last-run.status"'
fresh
BACKUP_OFFHOST_METHOD=bogus scheduled; rc=$?
check "exit 2 for unknown method" '[[ $rc -eq 2 ]]'

echo "7. overlap lock"
fresh
sleep 30 & holder=$!
mkdir "$WORK/lock" && echo "$holder" >"$WORK/lock/pid"
scheduled; rc=$?
check "second run skipped with exit 75 while lock holder is alive" '[[ $rc -eq 75 ]]'
check "no dump created while locked" '[[ -z "$(find "$WORK/out" -name "*.gz")" ]]'
kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null
scheduled; rc=$?
check "stale lock reclaimed after holder exits" '[[ $rc -eq 0 ]]'

echo "8. config file permissions are enforced"
if [[ "$(uname -s)" == Linux* ]]; then
  echo "BACKUP_RETENTION_DAYS=14" >"$WORK/loose.env"; chmod 644 "$WORK/loose.env"
  BACKUP_CONFIG="$WORK/loose.env" BACKUP_DIR="$WORK/out" BACKUP_LOG_FILE="$WORK/backup.log" \
    BACKUP_LOCK_DIR="$WORK/lock" "$ROOT_DIR/scripts/backup-scheduled.sh" 2>/dev/null; rc=$?
  check "world-readable config refused" '[[ $rc -eq 1 ]]'
else
  echo "  skip - config permission check (not Linux)"
fi

echo "9. restore drill into a throw-away database"
fresh
dump="$(run_backup)"
BACKUP_DIR="$WORK/out" "$ROOT_DIR/scripts/verify-backup-restore.sh" "$dump" 2>"$WORK/restore.log"; rc=$?
check "restore check passes" '[[ $rc -eq 0 ]] && grep -q "RESTORE CHECK PASSED" "$WORK/restore.log"'
check "throw-away database dropped" 'grep -q "dropped ecomesta_restore_check_" "$WORK/restore.log"'
echo "   corrupt dump must fail:"
printf 'not gzip' >"$WORK/out/ecomesta-postgres-corrupt.sql.gz"
BACKUP_DIR="$WORK/out" "$ROOT_DIR/scripts/verify-backup-restore.sh" "$WORK/out/ecomesta-postgres-corrupt.sql.gz" 2>/dev/null; rc=$?
check "corrupt dump rejected" '[[ $rc -ne 0 ]]'

echo
echo "passed: $pass  failed: $fail"
[[ $fail -eq 0 ]]
