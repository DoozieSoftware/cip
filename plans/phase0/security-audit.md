# Textile Module Security Audit (read-only, pre-lifecycle-extension)

Paths relative to `backend/` unless noted. Docs = `../docs/11-Security-and-Anti-Fraud-Specification.md`.

## ABILITIES

- Gate abilities are module-scoped `textile.*`, registered in `app/Modules/TextileCollections/Providers/TextileCollectionsServiceProvider.php:22-27` — complies with AGENTS.md global-ability rule.
- Policy methods: `viewQueue` :19, `view` :24, `scheduleBatch` :37, `recordOutcome` :42, `cancel` :47, `report` :52, partner check `isCollectionPartner` :62 (active dept + ≥1 `textile_partner_capabilities` row).
- `BasePolicy::before` (`app/Modules/Shared/Policies/BasePolicy.php:42`) denies deleted/suspended users, bypasses for `super_admin`/`system` :35 — textile inherits this (docs/11 §9).
- Route bindings: queue/schedule/report/updateZone/show/approve/outcome/proof `routes/api.php:385-408`; citizen show/cancel/photo `routes/api.php:440-448`.
- Smells: `approve` and staff `proof` reuse `can:textile.record_outcome` (`routes/api.php:401,407`); `updateZone` reuses `textile.schedule_batch` (`:395`); citizen photo upload gated by `textile.view` (`:447`) with ownership re-checked in controller (`TextileCollectionController.php:286-296`). Ability-to-action mapping is fuzzy but not a hole — controller double-checks via `assertCollectionPartner` (`:432-455`, partner check `:442`, ownership `:451`).
- Second authorization path duplicates policy logic: `assertCollectionPartner` uses raw DB (`:442`) and query-param `department_id` switching (`:436-439`), independent of the Gate.

## AUDIT

- Service-level audits: `approve` (`TextileCollectionOperationsService.php:26-30`), `scheduleBatch` (`:105-109`, inside tx), `recordOutcome` (`:159-164`) via private `audit()` (`:221-236`) writing `AuditLog` with user, entity, action, before/after, IP, `request_id`=trace_id (`RequestId` middleware, `app/Modules/Shared/Http/Middleware/RequestId.php:15`). Covers docs/11 §28 "Status Change".
- `updateZone` audits **in the controller** (`TextileCollectionController.php:570-585`) — violates AGENTS.md "controllers coordinate only"; `device_fingerprint` is always null (`:579`, service `:232`) though docs/11 §10 requires it.
- No audit on citizen photo upload, staff proof upload, or `create` — only chain-of-custody rows (below) and `TextileCollectionAcknowledged` event (`TextileCollectionService.php:97`). No status-change audit exists outside the service; new states must route through `audit()`.

## MEDIA

- Textile photos live in shared `media` table via nullable `textile_collection_id` FK (`database/migrations/2026_08_27_000100_add_textile_collection_id_to_media_table.php:24-31`); `storage_path` unique (`2026_06_27_060000_create_media_table.php:58`), `checksum` indexed not unique (`:64,83`).
- Pipeline `TextileCollectionMediaService::store`: disk from `config('cip.media.disk')` (`:93-94`), path `evidence|proof/textile/<uuid>/photo/<uuid>.<ext>` (`:96-101`), sha256 computed **before write** with regex guard (`:107-113`), stream write, `Media` row with checksum/disk/path/size (`:130-150`), `ChainOfCustodyWriter::EVENT_UPLOAD` (`:152-158`, writer per docs/11 §15, `ChainOfCustodyWriter.php:20-34`), then `ComputeHashesJob`/`GenerateThumbnailJob` (`:162-163`).
- **Bypasses quarantine/virus scan**: `'scan_status' => MediaScanStatus::CLEAN` set directly (`:24` docblock admits it, `:144`) while report media goes through `MediaQuarantineService::ingest` (`app/Modules/Media/Services/MediaService.php:147`, scanner contract `app/Modules/Media/Contracts/VirusScanServiceInterface.php`). Contradicts docs/11 §14/§32 posture.
- Evidence replacement = soft `is_replaced=true`, never delete (`:52-61`) — matches docs/11 §15 "no overwrite". Proof capped at 3 (`:31,183-197`).
- Signed URLs: `MediaUrl::temporary` 15-min TTL (`MediaUrl.php:44-46`); evidence on S3/MinIO gets driver presigned URL that bypasses the app entirely (`:57-60`) → **no DOWNLOAD custody row** for S3 evidence; proof always traverses `api.v1.media.serve` signed route (`:74-82`, route `routes/api.php:292`, `middleware('signed')`, not authed).
- Proof scope check `MediaDeliveryService::hasValidProofScope` (`:83-92`) compares `assignment_id`/`department_id` with `hash_equals`. Textile proof is created with **both null** (`TextileCollectionMediaService::store` never sets them; scoping migration `2026_08_12_000750` only backfills report proof), and `MediaUrl` sends `assignment=''&department=''` (`MediaUrl.php:76-81`) → `hash_equals('','')` **always passes**: proof scope is vacuous for textile; only the URL signature + 15-min TTL protects it. Serve records DOWNLOAD custody (`MediaDeliveryService.php:57-65`) and blocks non-CLEAN (`:33-38`) — trivially satisfied by textile's hardcoded CLEAN.
- Upload-time validation: `UploadTextilePhotoRequest` mimes jpeg/png/webp, 10 MB (`UploadTextilePhotoRequest.php:26-31`) + `MimeValidator` + service byte cap (`:166-177`). Extension trust: client extension used verbatim (`:206-219`) but mime validated.

## NOTIFICATIONS

- Listeners registered explicitly in `app/Providers/AppServiceProvider.php:71-74` (acknowledged/scheduled/collected/rejected); e.g. `SendTextileCollectedNotification.php:39-52` dispatches `textile.collected` with **hard override `'channel' => 'email'`**.
- `NotificationDispatcher::dispatch`: renders template → resolves channel (override must be in `push|email|sms|webhook` whitelist, `NotificationDispatcher.php:128-146`) → consent check `preferences->isEnabled(user, channel, code)` (`:74-88`, suppressed rows persisted `STATUS_DEAD`/`opted_out`, logged to `notifications` channel) → persists `pending` row in tx (`:94-107`) → `SendNotificationJob` (`:110`).
- Consent = per-(user, channel, event_code) preference (`NotificationPreferenceService.php:22-35`); **default is opt-in for every event** (`:79-81`). There is no separate marketing/consent flag; SMS is whitelisted as a channel but no textile listener uses it. OTP delivery logs plaintext to `sms` log channel (`OtpService.php:55-58`) — dev-only design.
- Listener failures are swallowed to `Log::warning` (`SendTextileCollectedNotification.php:53-60`) — citizen-facing notification failures produce no audit row.

## RATELIMIT

- Named limiters `app/Providers/RouteServiceProvider.php:101-197`; docs/11 §21 caps mapped: citizen 60/min `:148-152` (textile citizen routes `routes/api.php:412-448`), department 300/min `:174-178` (staff textile routes `:327-408`), OTP per-hour per-IP from tunable policy `:101-108` (`SecurityPolicyService.php:35,116`).
- OTP: `throttle:otp` on send-otp (`routes/api.php:81-83`) **plus** service-level dual caps per mobile and per IP (`OtpService.php:170-192`), bcrypt-hashed codes never persisted plaintext (`:82`), 5-attempt cap with consumed-on-exhaustion (`:32,151-160`), 5-min expiry (`:83-84`). Compliant with docs/11 §6/§21.
- **Textile uploads are not under `LIMITER_UPLOADS`** (`:159-164`; absent on `routes/api.php:406,446`), and the byte-budget middleware `app/Modules/Media/Http/Middleware/MediaUploadLimit.php` is registered nowhere (grep: no references). docs/11 §21 "Uploads 100 MB/hour" is unenforced for textile (report path at `routes/api.php:423` shares this gap).

## CONCURRENCY

- `scheduleBatch` is the only protected path: `DB::transaction` + `lockForUpdate()` on selected requests, count-equality check, per-row status guard (`ready_to_group|missed`), same-zone guard (`TextileCollectionOperationsService.php:48-116`).
- `recordOutcome` has **no transaction, no row lock**: guard (`:126`→`assertOutcomeAllowed` :179-196) → `update` (`:158`) is TOCTOU; two concurrent "collected" calls can both pass, double-write `picked_up_at`, emit two `AuditLog` rows and two `TextileCollectionCollected` events → duplicate emails (`:169`; listeners `AppServiceProvider.php:71-74`).
- `approve` same pattern (`:22-32`). Proof-existence guard `assertProofPhotoExists` (`:198-210`) is not race-safe with proof deletion/replacement.
- DB-level safety nets are weak: batches `reference` unique (`2026_08_25_000100_create_textile_collection_tables.php:35`), requests `reference` unique (`2026_08_25_000300_...php:55`), `media.storage_path` unique — but **no status CHECK, no unique constraint on `(id,status)` transitions, no version/optimistic-lock column** on `textile_collection_requests`.
- Idempotency: global `IdempotencyKey` middleware (`bootstrap/app.php:82`) with `(key,user_id)` unique replay arbitration (`app/Modules/Shared/Http/Middleware/IdempotencyKey.php:27-33`) but it is **opt-in per request** — absent header passes through (`:59-66`). docs/11 §23 requires idempotency keys on submissions; not enforced for outcome/schedule.

## REQUIRED-REUSE

For a new **drop-off receipt action** and **trip-assignment action**:

1. New `Gate::define('textile.<action>', ...)` methods in `TextileCollectionPolicy` + `TextileCollectionsServiceProvider.php:22-27` pattern; plus `assertCollectionPartner($request, $collection)` for department scoping (`TextileCollectionController.php:432-455`).
2. `DB::transaction` + `lockForUpdate()` + count/status guards exactly as `scheduleBatch` (`TextileCollectionOperationsService.php:48-80`) — copy this, not `recordOutcome`.
3. Status transition whitelist via `assertOutcomeAllowed`-style match table (`:179-196`) and new `STATUS_*` constants on `TextileCollectionRequest.php:60-72`.
4. Audit via the service's private `audit()` (`:221-236`) with trace_id/request_id, before/after (docs/11 §28).
5. Any receipt/evidence bytes: reuse `TextileCollectionMediaService::store` (checksum-before-write, chain-of-custody `EVENT_UPLOAD`, disk from config, `:90-163`) **after fixing scan_status**, serve only via `MediaUrl::temporary` + signed `api.v1.media.serve` (docs/11 §15).
6. Lifecycle change → Laravel Event + `NotificationDispatcher::dispatch` with template code so preference check applies (`NotificationDispatcher.php:74-88`); do not call channels directly.
7. Require `Idempotency-Key` header on the new mutating endpoints (§23) and put uploads under `throttle:uploads` + `MediaUploadLimit` (§21).

## UNPROTECTED

1. `recordOutcome`/`approve`: no lock/tx → double transitions, duplicate audit + notification races (`TextileCollectionOperationsService.php:22-32,122-175`).
2. No DB constraint backing the state machine (no CHECK, no optimistic locking) on `textile_collection_requests` (`2026_08_25_000100:51-86`).
3. Idempotency optional on all textile mutations (`IdempotencyKey.php:59-66`).
4. Textile media skips virus scan/quarantine — `scan_status` hardcoded CLEAN (`TextileCollectionMediaService.php:24,144` vs `MediaService.php:147`).
5. Textile proof scope vacuous: null `assignment_id`/`department_id` + `hash_equals('','')` (`MediaDeliveryService.php:83-92`, `MediaUrl.php:76-81`).
6. S3 evidence presigned URLs bypass app → no DOWNLOAD custody log (`MediaUrl.php:57-60`).
7. Upload byte budget (docs/11 §21 100MB/h) unenforced: `LIMITER_UPLOADS`/`MediaUploadLimit` not applied to textile routes (`routes/api.php:406,446`).
8. `device_fingerprint` always null on textile audits (`TextileCollectionOperationsService.php:232`) despite docs/11 §10.
9. Authorization duplicated (Gate policy vs controller raw-DB partner check, `:442`) — drift risk when new states partition duties.
10. Notification dispatch failures only log, never audit (`SendTextileCollectedNotification.php:53-60`).
11. Audit written in controller for `updateZone` (`TextileCollectionController.php:570`) — layering violation, easy to omit in new actions.
