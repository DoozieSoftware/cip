# Production Setup — Queue, Scheduler, and Cron

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** Active
**Depends On:** `docs/14-DevOps-and-Deployment.md`

---

# 1. Purpose

This document defines the production cron table, worker topology, and monitoring hooks required for the queue and scheduler subsystem on cPanel shared hosting.

Without these cron entries installed on the server, the following will silently fail:

- Media processing (hash, thumbnail, video metadata)
- AI pipeline orchestration
- Notification delivery
- SLA breach detection
- Data retention purging

---

# 2. Cron Table (cPanel)

Install these via cPanel → Cron Jobs (or `crontab -e` on the server):

```cron
# Scheduler — must run every minute. Dispatches scheduled jobs and tasks.
* * * * * cd ~/cip && /opt/alt/php84/usr/bin/php artisan schedule:run >> /dev/null 2>&1

# Media queue — CPU/I/O bound (hash, thumbnail, video probe). 180s timeout.
* * * * * cd ~/cip && /opt/alt/php84/usr/bin/php artisan queue:work --queue=media --stop-when-empty --tries=1 --timeout=180 >> /dev/null 2>&1

# AI queue — vision pipeline. 300s timeout (provider calls can be slow).
* * * * * cd ~/cip && /opt/alt/php84/usr/bin/php artisan queue:work --queue=ai --stop-when-empty --tries=1 --timeout=300 >> /dev/null 2>&1

# Notifications queue — SMS/email/push/webhook delivery. 60s timeout.
* * * * * cd ~/cip && /opt/alt/php84/usr/bin/php artisan queue:work --queue=notifications --stop-when-empty --tries=1 --timeout=60 >> /dev/null 2>&1

# Default queue — SLA breach check (scheduled), any unclassified job. 120s timeout.
* * * * * cd ~/cip && /opt/alt/php84/usr/bin/php artisan queue:work --queue=default --stop-when-empty --tries=1 --timeout=120 >> /dev/null 2>&1
```

**Notes:**

- `--stop-when-empty` ensures each worker exits after draining its queue. The next cron tick starts a fresh worker. This avoids long-running processes on shared hosting.
- `--tries=1` means a failed job is NOT retried by the worker. Jobs that need retry logic implement their own backoff via `$tries` and `$backoff` on the job class.
- PHP binary path `/opt/alt/php84/usr/bin/php` is the cPanel PHP 8.4 selector. Verify with `which php` or your hosting provider's docs.
- Each worker writes to `/dev/null` to avoid unbounded log growth. Application-level logging is handled by Laravel's `Log` facade.

---

# 3. Queue Topology

| Queue | Worker Timeout | Jobs |
|-------|---------------|------|
| `media` | 180s | `ComputeHashesJob`, `GenerateThumbnailJob`, `ExtractVideoMetadataJob` |
| `ai` | 300s | `AiPipelineOrchestrator` |
| `notifications` | 60s | `SendNotificationJob` |
| `default` | 120s | `CheckSlaBreaches` (scheduled), any job without `onQueue()` |

**Queue targeting is set in each job's constructor via `$this->onQueue('name')`.** To add a new queue, add a `onQueue()` call in the job constructor AND add a corresponding cron entry above.

---

# 4. retry_after vs Worker Timeout

`retry_after` (in `config/queue.php` / `DB_QUEUE_RETRY_AFTER`) is the seconds Laravel waits before considering a job "timed out" and re-dischatching it. The worker `--timeout` is the hard SIGTERM signal after N seconds.

**Rule: `retry_after` MUST be greater than the longest `--timeout`.**

If `retry_after` < `--timeout`:
1. Job starts at T=0
2. At T=retry_after, Laravel assumes the job died and re-dispatches it
3. Two instances of the job run concurrently
4. Data corruption, duplicate notifications, duplicate AI results

**Current values:**

| Setting | Value |
|---------|-------|
| `DB_QUEUE_RETRY_AFTER` | 360s (config default in `config/queue.php`) |
| Longest worker `--timeout` | 300s (ai queue) |
| Margin | 60s |

The AI job (`AiPipelineOrchestrator`) has `$tries = 40` with exponential backoff up to 300s. This is the job most likely to hit timeout boundaries. If the AI provider latency grows beyond 300s, raise `DB_QUEUE_RETRY_AFTER` further (e.g. 420s) — it must always exceed the longest worker `--timeout`.

---

# 5. Scheduler Registration

The scheduler is registered in `backend/bootstrap/app.php` via `->withSchedule()`:

- `CheckSlaBreaches` — every 5 minutes, `withoutOverlapping()`
- `PurgeRetentionCommand` — daily at 03:00, `withoutOverlapping()`, conditional on `retention.purge_enabled` setting

**The scheduler only fires if `schedule:run` is installed as a cron.** Without the scheduler cron, no scheduled jobs are dispatched to the queue.

---

# 6. Production cache requirement

The supported production profile uses `CACHE_STORE=redis` so web, queue, and
scheduler processes share one fast cache. Application cache operations remain
compatible with Laravel's file and database stores; routing uses a dedicated
key rather than cache tags.

The cPanel PHP build must provide `ext-redis` and the Redis service must be
reachable at the configured host/port when the production profile is enabled.

The deploy workflow rejects a production template that regresses to the file
cache and probes both `PONG` and a cache round-trip. The `/api/v1/health/ready`
endpoint repeats that check at runtime and returns `503` when Redis is down.
Do not switch production to the file or array driver to silence an outage;
repair Redis or roll back to a known-good release.

---

# 7. Monitoring Hooks

## 7.1 Queue Age Alert

Add a cron that alerts when jobs are stuck in the queue beyond a threshold:

```bash
# Check for jobs older than 15 minutes in any queue (run every 5 minutes)
*/5 * * * * cd ~/cip && /opt/alt/php84/usr/bin/php artisan tinker --execute="
    \\$old = \\DB::table('jobs')->where('created_at', '<', now()->subMinutes(15))->count();
    if (\\$old > 0) { \\Log::warning('queue.age.alert', ['stuck_jobs' => \\$old]); }
" >> /dev/null 2>&1
```

Or use a dedicated artisan command if available.

## 7.2 Failed Job Monitor

Failed jobs are stored in the `failed_jobs` table (configured in `config/queue.php`). Monitor with:

```bash
# Alert when failed jobs exist (run every 15 minutes)
*/15 * * * * cd ~/cip && /opt/alt/php84/usr/bin/php artisan tinker --execute="
    \\$failed = \\DB::table('failed_jobs')->where('failed_at', '>', now()->subMinutes(15))->count();
    if (\\$failed > 0) { \\Log::error('queue.failed.alert', ['recent_failures' => \\$failed]); }
" >> /dev/null 2>&1
```

## 7.3 Health Check Endpoint

The `/up` endpoint (defined in `bootstrap/app.php`) returns 200 when the app boots. For deeper queue health, extend it or add a custom endpoint that checks:

- `jobs` table count by queue
- `failed_jobs` table count (last hour)
- Scheduler last run time (via `schedule:run` output or a heartbeat table)

---

# 8. Deploy Workflow Changes Needed

The deploy workflow (`.github/workflows/deploy-production.yml`) currently installs only a single `queue:work` cron for the `default` queue. It needs to be updated to install all four workers plus the scheduler.

**Required changes (owned by deploy team — do NOT edit):**

1. **Add scheduler cron** — currently missing. Without it, `CheckSlaBreaches` and `PurgeRetentionCommand` never fire.
2. **Add media queue worker** — currently missing. Media jobs are dispatched but never processed.
3. **Add ai queue worker** — currently missing. AI pipeline never runs.
4. **Add notifications queue worker** — currently missing. Notifications are never delivered.
5. **Remove `--max-time=300`** from the final `queue:work` call — this overlaps with the per-minute cron and can cause duplicate job processing.
6. **Ensure `DB_QUEUE_RETRY_AFTER=360`** is set in `.env.cpanel` (or rely on the config default of 360s in `config/queue.php`). This exceeds the longest worker `--timeout` (300s) by 60s.

The deploy workflow's crontab install block should look like:

```bash
# Install all queue workers + scheduler
SCHEDULE_CRON="* * * * * cd \$HOME/cip && $PHP_BIN artisan schedule:run >> /dev/null 2>&1"
MEDIA_CRON="* * * * * cd \$HOME/cip && $PHP_BIN artisan queue:work --queue=media --stop-when-empty --tries=1 --timeout=180 >> /dev/null 2>&1"
AI_CRON="* * * * * cd \$HOME/cip && $PHP_BIN artisan queue:work --queue=ai --stop-when-empty --tries=1 --timeout=300 >> /dev/null 2>&1"
NOTIFICATIONS_CRON="* * * * * cd \$HOME/cip && $PHP_BIN artisan queue:work --queue=notifications --stop-when-empty --tries=1 --timeout=60 >> /dev/null 2>&1"
DEFAULT_CRON="* * * * * cd \$HOME/cip && $PHP_BIN artisan queue:work --queue=default --stop-when-empty --tries=1 --timeout=120 >> /dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v 'artisan queue:work' | grep -v 'artisan schedule:run' || true; echo "\$SCHEDULE_CRON"; echo "\$MEDIA_CRON"; echo "\$AI_CRON"; echo "\$NOTIFICATIONS_CRON"; echo "\$DEFAULT_CRON") | crontab -;
```

---

# 9. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Media jobs stuck in `jobs` table | No worker consuming `media` queue | Add media queue cron |
| AI results never appear | No worker consuming `ai` queue | Add ai queue cron |
| Notifications never sent | No worker consuming `notifications` queue | Add notifications cron |
| SLA breaches never detected | Scheduler cron not installed | Add `schedule:run` cron |
| Jobs running twice | `retry_after` < `--timeout` | Increase `DB_QUEUE_RETRY_AFTER` |
| Moderator action reports unsupported cache tags | A legacy release is using tagged routing cache with a file/database store | Deploy the current release, which uses a portable dedicated cache key |
| `failed_jobs` table growing | Job failures not being cleaned | Run `queue:flush` or prune manually |
