# Production backup, restore, and rollback runbook

The deployment workflow creates a timestamped backup before it changes
`~/cip`. Backups are three separate recovery domains:

1. `database.sql.gz` — MySQL schema/data, routines, and triggers.
2. `evidence-storage.tar.gz` — evidence bytes under `storage/app/media`.
3. `production.env` — configuration including the production `APP_KEY`.

`SHA256SUMS` is checked before a rollback. Backups are kept under
`~/cip-backups/<UTC timestamp>` with mode `0700`; copy them to an immutable,
off-host location after each release. Target RPO is 24 hours (nightly backup
plus the pre-deploy backup); target RTO is 60 minutes for code and 4 hours for
a full database/evidence restore.

## Verify a backup

```bash
cd ~/cip-backups/20260812T120000Z
sha256sum -c SHA256SUMS
gzip -t database.sql.gz
tar -tzf evidence-storage.tar.gz >/dev/null
```

Never replace a newer evidence object with an older archive. Restore evidence
to a temporary directory, compare object size and SHA-256 against the media
rows, then copy only missing objects.

## Code rollback

The rollback script restores only immutable release files and preserves the
live `.env` and `storage/` directory:

```bash
CONFIRM_ROLLBACK=YES ~/cip/rollback-production.sh \
  ~/cip-backups/20260812T120000Z
```

The deploy workflow installs this helper as `~/cip/rollback-production.sh`.
For manual packaging, copy `deploy/production/rollback-production.sh` to that
path before use.

## Database restore (explicit and disruptive)

Database restore is a separate, approved operation because it rewinds reports,
users, audit rows, and tokens. Stop queue workers first, take a fresh backup,
then run:

```bash
CONFIRM_ROLLBACK=YES RESTORE_DATABASE=YES \
  ~/cip/rollback-production.sh \
  ~/cip-backups/20260812T120000Z
```

Preserve the current `APP_KEY`; encrypted values and Sanctum tokens depend on
it. After restore, run `php artisan migrate:status`, `php artisan route:cache`,
the readiness endpoint, and a signed-media download smoke test before workers
resume. Record the drill date, backup ID, checksums, and observed RTO.
