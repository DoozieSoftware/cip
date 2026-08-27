# Textile Collections — Phase 1 (Drop-off Receipt) + Phase 2 (Trip Assignment): Backend Spec

Status: **design only**. Phase 0 register is unresolved (`plans/textile-phase-0-decision-register.md:1-14`, all D-01..D-08 `Status: Open`). Nothing below is approved for implementation; rows marked **[OPEN]** carry the options list into §OPEN_DECISIONS.

## Evidence anchor (current state)

- Statuses are one flat column: `pending_review, ready_to_group, scheduled, picked_up, rejected, cancelled, missed` — `backend/app/Modules/TextileCollections/Models/TextileCollectionRequest.php:60-72`.
- `approve()` sends **every** method to `ready_to_group`, ignoring `collection_method` — `Services/TextileCollectionOperationsService.php:21-32`.
- `scheduleBatch()` gates on status only (`ready_to_group`/`missed`) + same-zone; no method check, so an approved drop-off is schedulable — `TextileCollectionOperationsService.php:66-77`, `CreateCollectionBatchRequest.php` (no method rule).
- `recordOutcome()` `collected→picked_up` requires a `role=proof` media row — `TextileCollectionOperationsService.php:133-165,198-211`; proof cap 3 — `TextileCollectionMediaService.php:29`.
- Batch has zone/date/window/`status`(free string, `'planned'` literal at `TextileCollectionOperationsService.php:86`)/`trip_reference`/`instructions`; **no** team, driver, vehicle, stop order, or progress fields — `Models/TextileCollectionBatch.php:26-30`; no `STATUS_*` constants.
- Zone holds one drop-off name/address, no hours/contact/closure — `Models/TextileServiceZone.php:26-27`, `database/migrations/2026_08_25_000100_create_textile_collection_tables.php:14-30`.
- AuthZ = 6 global gates + "department has ≥1 capability row" — `Providers/TextileCollectionsServiceProvider.php:22-27`, `Policies/TextileCollectionPolicy.php:59-77`; ownership re-check in controller `Http/Controllers/TextileCollectionController.php` (`assertCollectionPartner`).
- `Idempotency-Key` middleware is global (reserve/replay, unique-key race arbitration) — `bootstrap/app.php:82`, `Shared/Http/Middleware/IdempotencyKey.php:31-160`.
- Audit is append-only, `action` capped at 32 chars — `database/migrations/2026_06_26_190000_create_audit_logs_table.php:43-66`, immutability `Security/Models/AuditLog.php:13-20`.
- Notifications: 4 textile templates (`textile.acknowledged|scheduled|collected|rejected`) — `database/seeders/NotificationTemplatesSeeder.php:91-120`; listeners swallow dispatch failures — `Listeners/SendTextileScheduledNotification.php:52-66`.

## STATUSES

Keep **one** `status` column on requests (single machine per method lane); put trip progress on the **batch**, not the request, to avoid two authorities over one request.

Premises lane (unchanged): `pending_review → ready_to_group → scheduled → picked_up | missed | rejected | cancelled` (`TextileCollectionOperationsService.php:118-211`).

New/derived, minimal set:

| status                  | lane     | meaning                                                                   | written by                                                                          |
| ----------------------- | -------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `dropoff_awaiting_drop` | dropoff  | approved; centre details + reference issued; **must never enter a batch** | new `confirmDropoff()` (successor of `approve()` for `collection_method='dropoff'`) |
| `received_at_centre`    | dropoff  | terminal; centre recorded receipt                                         | new `recordReceipt()`                                                               |
| `ready_to_group`        | premises | unchanged, trip-schedulable set stays `{ready_to_group, missed}`          | unchanged                                                                           |

Transitions to add: `pending_review → dropoff_awaiting_drop`; `dropoff_awaiting_drop → received_at_centre`; `dropoff_awaiting_drop → cancelled` (citizen + staff). New guards: `collected` stays reachable only from `scheduled` (`:181-190`) and is rejected for `collection_method='dropoff'`; `recordReceipt` accepts only `dropoff_awaiting_drop`.

**[OPEN]** extra drop-off end states: (a) none — expiry handled by cancellation/exception reason; (b) `dropoff_expired` / `no_show`; (c) staff-only `cancelled` with reason. See D-01/D-02.

Batch machine (Phase 2): `planned → assigned → in_progress → completed`, plus `cancelled`; enforce with `TextileCollectionBatch::STATUS_*` constants replacing the `'planned'` literal (`:86`). **[OPEN]** whether a stop-level request status (`en_route`/`visited`) is required, or batch progress + existing `outcome` suffices (D-04).

## SCHEMA

New migrations only (AGENTS.md); next free prefix after `2026_08_28_000200_retire_scrap_and_ewaste_report_types.php`.

**1. `2026_09_05_000100_add_dropoff_centre_config_to_textile_service_zones.php`**

- `operating_hours` JSON null, `public_phone` string(32) null, `centre_status` string(16) default `open` (`open|temporarily_closed`), `centre_closed_note` text null, `receipt_requires_photo` bool default true, `receipt_requires_bags`/`receipt_requires_weight` bool default true **[OPEN: D-02/D-03 proof subset]**, `max_open_dropoffs_per_citizen` smallint null **[OPEN: D-07]**.
- index `centre_status`; keep existing single name/address (`TextileServiceZone.php:26-27`) as the zone's one centre. **[OPEN: D-01]** option (b): separate `textile_dropoff_centres` (`id, service_zone_id FK restrict, name, address, lat/lng decimal(10,7), operating_hours, phone, status, active`, index `(service_zone_id, active)`) + `textile_collection_requests.dropoff_centre_id` FK nullOnDelete — required only if a zone may have >1 centre.

**2. `2026_09_05_000200_add_dropoff_lane_to_textile_collection_requests.php`**

- `dropoff_confirmed_at` timestamp null, `dropoff_valid_from` date null, `dropoff_valid_until` date null **[OPEN: D-01 validity]**, `receipt_id` uuid null (no FK — set after insert) → **prefer** receipt table's unique FK as authority; then status CHECK: MySQL 8.4 supports `CHECK`; add `chk_textile_method_status` restricting dropoff statuses to the dropoff lane where enforcement is testable in both MySQL (CI) and SQLite (`phpunit.xml`) — if SQLite/MySQL grammar diverges, enforce in service + feature tests instead and record the decision.
- index `(service_zone_id, status, collection_method)` (replaces reliance on `:97` index for lane filtering).

**3. `2026_09_05_000300_create_textile_dropoff_receipts_table.php`**

```
id uuid PK; collection_request_id uuid NOT NULL UNIQUE
  FK → textile_collection_requests.id restrictOnDelete   -- 1 receipt per booking
received_by uuid NOT NULL FK → users.id restrictOnDelete
service_zone_id uuid NOT NULL FK → textile_service_zones.id restrictOnDelete
received_at timestamp NOT NULL; actual_bags smallint unsigned null
actual_weight_kg decimal(10,2) null; proof_media_id uuid null FK → media.id nullOnDelete
exception_code string(32) null; exception_reason text null
idempotency_key string(128) null UNIQUE   -- second guard beside middleware
timestamps
index (service_zone_id, received_at); index (received_by, received_at)
```

Append-only like `AuditLog` (`AuditLog.php:13-20`): corrections create a reversal row, never an UPDATE/DELETE. **[OPEN: D-02]** optional columns: `signature_captured`/`signature_media_id`, `captured_lat/lng`, `staff_device_id`.

**4. `2026_09_05_000400_add_trip_assignment_to_textile_collection_batches.php`**

- `assigned_team_id` uuid null FK → `departments.id` nullOnDelete **[OPEN: D-04 team entity]**, `assigned_user_id` uuid null FK → `users.id` nullOnDelete, `vehicle_label` string(64) null, `assignment_reason` text null, `assigned_by` uuid null FK → users nullOnDelete, `assigned_at`/`started_at`/`completed_at` timestamps null, `row_version` unsignedInteger default 0.
- index `(assigned_user_id, status, collection_date)`, index `(assigned_team_id, collection_date)`; CHECK `completed_at is null or started_at is not null`.
- Stop order **[OPEN: D-04]**: (a) `stop_order` unsignedSmallInteger on `textile_collection_requests` + index `(batch_id, stop_order)` — cheap, but orders live outside the trip aggregate; (b) new `textile_batch_stops` (`id`, `batch_id` FK cascadeOnDelete, `collection_request_id` FK restrictOnDelete, `stop_order` smallint, `visited_at` ts null, `visited_by` FK users null, UNIQUE `(batch_id, stop_order)`, UNIQUE `(collection_request_id)`) — keeps ordering inside the trip, needs the request↔stop sync rule. Recommend (b) if reordering/multi-operator visits are in scope.
- **[OPEN]** contact-via-proxy for "call customer" (D-04): masked/virtual number via connector framework vs. no call action in Phase 2. Nothing may expose staff personal numbers (`plans/textile-collection-next-phases.md` Phase 2 guardrails).

## API

Citizen (group `auth:sanctum` + citizen throttle, pattern `routes/api.php:438-448`):

- `GET citizen/textile-collections/{collection}` — extend resource with `next_step`, centre block, receipt summary (resource currently returns only zone name/address: `Http/Resources/TextileCollectionResource.php:56-62`).
- unchanged cancel/photo routes; cancel must accept the new drop-off statuses (replaces the hardcoded terminal list in `TextileCollectionController.php` `citizenCancel`).

Partner desk (`routes/api.php` department group):

| method/path                                                      | gate                      | FormRequest                                                                                                     | service                                                                                        |
| ---------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET department/textile-collections?method=&status=`             | `textile.view_queue`      | —                                                                                                               | index gains `collection_method` filter (absent today, `TextileCollectionController.php:index`) |
| `POST department/textile-collections/{collection}/approve`       | `textile.approve`         | `ApproveTextileCollectionRequest` (centre + validity + `Idempotency-Key` required)                              | `confirmDropoff()` / `approvePickup()`                                                         |
| `GET department/dropoff-centres/lookup?reference=`               | `textile.record_receipt`  | —                                                                                                               | counter lookup by reference                                                                    |
| `POST department/dropoff-centres/{zone}/receipts`                | `textile.record_receipt`  | `RecordDropoffReceiptRequest`                                                                                   | `TextileReceiptService::record()`                                                              |
| `POST department/dropoff-receipts/{receipt}/reversal`            | `textile.reverse_receipt` | `ReverseDropoffReceiptRequest` (reason required)                                                                | `TextileReceiptService::reverse()` **[OPEN: D-02]**                                            |
| `PUT department/textile-zones/{zone}` (extend)                   | `textile.manage_centre`   | `UpdateTextileZoneRequest` (replaces inline `validate` at `TextileCollectionController.php:updateZone`)         | centre config incl. closure                                                                    |
| `POST department/textile-batches/{batch}/assignment`             | `textile.assign_trip`     | `AssignTextileBatchRequest` (`assigned_team_id`/`assigned_user_id`/`vehicle_label`/`reason`, `Idempotency-Key`) | `TextileTripService::assign()`                                                                 |
| `POST department/textile-batches/{batch}/start` / `.../complete` | `textile.operate_trip`    | `StartTextileBatchRequest` / `CompleteTextileBatchRequest`                                                      | `TextileTripService`                                                                           |
| `PUT department/textile-batches/{batch}/stops/order`             | `textile.assign_trip`     | `ReorderTextileBatchStopsRequest` (full ordered id list)                                                        | `TextileTripService::reorder()`                                                                |
| `GET department/textile-trips/mine`                              | `textile.operate_trip`    | —                                                                                                               | assigned manifest, ordered                                                                     |

FormRequest rules reuse existing shapes (`CreateCollectionBatchRequest.php`, `RecordCollectionOutcomeRequest.php`): bags `integer min:1 max:999`, weight `numeric min:0.1 max:99999.99`, reason `min:5 max:2000`. Receipt proof reuses `uploadProof` (`TextileCollectionMediaService.php:59-70`) — do not duplicate storage/checksum/chain-of-custody (`plans/textile-collection-next-phases.md` §10).

Business logic stays in services; controllers coordinate; validation in FormRequests; no SQL in controllers (AGENTS.md), so `assertCollectionPartner`'s raw `DB::table('textile_partner_capabilities')` (`TextileCollectionController.php`) must move to a repository before new endpoints ship.

## AUTHZ

Add module-scoped gates (pattern `TextileCollectionsServiceProvider.php:22-27`; AGENTS.md forbids generic `view` reuse):

- `textile.approve` — desk reviewer: partner capability + department ownership (today approve piggybacks `record_outcome`, `routes/api.php:400-402`).
- `textile.record_receipt` — centre staff: `isCollectionPartner(user, zone.department_id)` **and** centre-scoped membership; must not accept `textile.record_outcome`.
- `textile.reverse_receipt` — stricter, reviewer/admin only **[OPEN: D-02]**.
- `textile.manage_centre` — replaces centre edits borrowed from `textile.schedule_batch` (`routes/api.php:394-396`).
- `textile.assign_trip`, `textile.operate_trip` — assigner vs. assigned operator; `operate_trip` additionally requires the caller to be the batch's `assigned_user_id`/team member (D-04 acceptance: "a field worker sees only trips they are authorized to operate").

All new abilities keep `BasePolicy::before` semantics (suspended deny, `super_admin|system` bypass — `Shared/Policies/BasePolicy.php:40-62`) and must re-check `department_id` ownership server-side, as `assertCollectionPartner` does. Staff identity taxonomy is **[OPEN: D-02/D-04]**: (a) derive from department membership as today (`TextileCollectionPolicy.php:59-77`); (b) Spatie roles via `hasRoleOrPermission` (`BasePolicy.php:78-92`); (c) new `textile_staff_assignments` table `(user_id, department_id, service_zone_id, kind[desk|centre|crew], created_by)` — (c) is the only option that separates centre from crew.

## AUDIT

Append-only rows via the existing helper (`TextileCollectionOperationsService.php:219-239`), `action` ≤32 chars:

- `textile.approve_dropoff`, `textile.receipt_record`, `textile.receipt_reverse`, `textile.centre_update` (entity `textile_service_zone`), `textile.trip_assign`, `textile.trip_start`, `textile.trip_complete`, `textile.stop_reorder`.
- entity values: `textile_collection`, `textile_dropoff_receipt` (new), `textile_collection_batch`, `textile_service_zone`.
- `before/after` must carry status, actor-owned id, quantities, reason, and `request_id = trace_id`; notifications fail-open (log-only) exactly like the current listeners (`SendTextileCollectedNotification.php:57-66`).

## NOTIFY

New template codes, seeded idempotently in the `NotificationTemplatesSeeder.php:91-120` style; channel per code is **[OPEN: D-06]** (only `email`/`sms`/`push` drivers exist — `Notifications/Providers/NotificationsServiceProvider.php:28-48`):

| code                                | trigger event                                               | audience                                                             |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `textile.dropoff_approved`          | `TextileCollectionDropoffConfirmed`                         | citizen — centre name, address, hours, reference, validity window    |
| `textile.dropoff_reminder`          | scheduled job, before `dropoff_valid_until` **[OPEN D-06]** | citizen                                                              |
| `textile.dropoff_received`          | `TextileDropoffReceiptRecorded`                             | citizen — received bags/weight, staff first name optional, timestamp |
| `textile.dropoff_reversal`          | `TextileDropoffReceiptReversed`                             | citizen + partner **[OPEN]**                                         |
| `textile.trip_assigned`             | `TextileTripAssigned`                                       | assigned user/team leads                                             |
| `textile.trip_started` (on-the-way) | `TextileTripStarted`                                        | each request's citizen                                               |

Suppression required before sending: skip `cancelled|rejected|received_at_centre|picked_up` (D-06 acceptance). Reuse `textile.collected` for `picked_up`; do not send `textile.scheduled` to drop-off requests (the batch fan-out at `SendTextileScheduledNotification.php:38-67` must filter `collection_method='premises'`).

## CONCURRENCY / IDEMPOTENCY

- `Idempotency-Key` required on receipt, reversal, assignment, and schedule POSTs; middleware already arbitrates the reserve race and replays stored 2xx (`IdempotencyKey.php:76-116,132-160`). Documented client contract per docs/05 §20.
- Receipt: (1) middleware key, (2) `textile_dropoff_receipts.collection_request_id` UNIQUE, (3) `SELECT ... lockForUpdate()` on the request row inside `DB::transaction` (pattern `TextileCollectionOperationsService.php:57-63`), (4) guarded `UPDATE ... WHERE id=? AND status='dropoff_awaiting_drop'` and abort if `affected === 0`. Two concurrent submits ⇒ one receipt, one replayed response.
- Assignment/reorder: optimistic `row_version` on batch (`UPDATE ... WHERE id=? AND row_version=?`), audit both sides; reordering inside a started trip is rejected.
- Outcome overwrite guard (D-04 acceptance): status-conditional update so a second worker cannot re-finalize a request already in a terminal status; keeps `recordOutcome` the sole success path (`:118-177`).
- Batch membership: keep the existing row-lock + count-match check and add the method-lane rejection there (`:66-77`).

## MIGRATION / BACKFILL

New migrations only; never edit `2026_08_25_000100`…`2026_08_28_000100`.

- Phase 1 backfill (single transaction per table, idempotent, no destructive DDL — AGENTS.md):
    - `status='ready_to_group' AND collection_method='dropoff'` → `dropoff_awaiting_drop`, `dropoff_confirmed_at = updated_at`, validity dates null **[OPEN: D-01]**.
    - `status='picked_up' AND collection_method='dropoff'` → **do not rewrite status**; insert a synthetic `textile_dropoff_receipts` row (`received_by = created_by`-less → `received_by` = last auditor user or `null`-impossible ⇒ requires a real actor: rows with no identifiable staff user are left as-is and reported) **[OPEN: D-02/D-08 migration item]**; alternative is leaving them terminal in `picked_up` with a data-quality flag.
    - Any `scheduled` drop-off row produced by the current gap (`:66-77`) → un-batch decision needed: detach (`batch_id=null`) + notify, or grandfather to `picked_up` handling. **[OPEN: D-05]**
    - Zone centre config: seeded demo addresses ("not for production use", `TextileCollectionsSeeder.php:66-67,84-88`) must **not** become published citizen-facing centre data; require partner entry before `centre_status='open'`.
- Phase 2 backfill: existing batches → `status='planned'`, `assigned_*` null; `scheduled` requests with no assignment are legal (unassigned pool) **[OPEN: D-04]**. Stop-order rows, if option (b), seeded by `created_at` then `reference`.
- Rollback: reversible `down()` that drops new columns/tables only after the derived rows are removed; production path stays `migrate --force` only (`.github/workflows/deploy-production.yml` per AGENTS.md), never `migrate:fresh`.

## OPEN_DECISIONS

| id   | question                                                                                                             | options                                                                      | blocks                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| D-01 | Drop-off = reservation, walk-in, or both? booking validity window?                                                   | reservation-only / walk-in / per-zone; validity: none / N days / partner-set | lane start state, `dropoff_valid_*`, expiry state           |
| D-02 | Who records receipt; reference vs QR; mandatory proof subset; reversal & mismatch exception set                      | bags/weight/photo subsets; QR required or not; reversal allowed or not       | receipt columns, `textile.record_receipt` scope, checks     |
| D-03 | Centre information + closure ownership (hours, phone, closure, accessibility)                                        | free-text hours vs structured JSON; partner self-serve vs admin              | zone columns, `textile.manage_centre`                       |
| D-04 | Trip owner (driver / team / pool), vehicle mandatory?, order manual vs suggested, who assigns, citizen↔staff contact | driver-only / team / pool; masked number / in-app only / none                | batch columns, stops option (a)/(b), `textile.operate_trip` |
| D-05 | Reschedule & missed/cancel policy incl. legacy mis-batched drop-offs                                                 | pre-cutoff self-service / staff-only / new successor record                  | cancel rule, batch detach, new states                       |
| D-06 | Approved channels per lifecycle message + reminder timing + consent/rate limits                                      | email only / +sms / +push; reminder on/off                                   | NOTIFY channels, job schedule                               |
| D-07 | Quantity/capacity/eligibility thresholds & who may override                                                          | review flag / hard rule / recommendation only                                | centre+zone config columns                                  |
| D-08 | Offline capture, location capture, device data, conflicting-retry semantics                                          | none / coarse loc / precise loc; offline yes/no                              | staff device columns, retry semantics                       |
| —    | staff role model: membership-derived vs Spatie role vs `textile_staff_assignments`                                   | (a)/(b)/(c) above                                                            | AUTHZ for centre vs crew                                    |
| —    | one centre per zone or many                                                                                          | single (reuse zone fields) / `textile_dropoff_centres`                       | SCHEMA §1 option (b)                                        |
