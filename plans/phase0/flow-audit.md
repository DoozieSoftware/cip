# TextileCollections — As-Implemented Lifecycle Audit (read-only)

## STATUS MACHINE

**Request statuses** — 7 constants, `Models/TextileCollectionRequest.php:60-72`:
`pending_review` · `ready_to_group` · `scheduled` · `picked_up` · `rejected` · `cancelled` · `missed`

- Default `pending_review` (`database/migrations/2026_08_25_000100_create_textile_collection_tables.php:65`); set explicitly at creation (`Services/TextileCollectionService.php:90`).
- Terminal in code: `picked_up`, `rejected`, `cancelled`. `missed` is re-enterable → `scheduled`.
- No status constants on batch: `Models/TextileCollectionBatch.php:23-33` (no status consts, no helper).
- **Batch status** is a bare string column default `'planned'` (`...000100:39`) and `'planned'` is the _only_ value ever written (`Services/TextileCollectionOperationsService.php:86`). No other batch state exists.
- No `Jobs/` directory in the module (full tree: DTO, Events×4, Http, Listeners×4, Models×4, Policy, Provider, Services×3). Events are plain sync classes, not `ShouldQueue` (`Events/TextileCollectionAcknowledged.php:16-20`, `...Collected/Rejected/Scheduled.php` same shape).

## TRANSITIONS

| #   | From → To                                                               | Where                                          | Guard conditions                                                                                                                                                                                                                                                                           | Authorized                                                                                                                                                                                               | Audit                                                                                                   |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| T1  | ∅ → `pending_review`                                                    | `TextileCollectionService.php:72-93`           | zone exists + `active` (`:28-35`); `dropoff` needs `zone.dropoff_enabled` (`:37-39`); `premises` needs `premises_pickup_enabled` (`:41-43`); zone must have `department_id` (`:63-70`); `textile_partner_capabilities` row for `department+category` else `CATEGORY_NOT_SERVED` (`:48-62`) | any authenticated `User` (`Http/Requests/StoreTextileCollectionRequest.php:14-16`; citizen group `routes/api.php:412,417`)                                                                               | **none** (`:72-97` writes no AuditLog)                                                                  |
| T2  | `pending_review` → `ready_to_group`                                     | `TextileCollectionOperationsService.php:21-33` | status must be `pending_review` (`:23-25`)                                                                                                                                                                                                                                                 | `textile.record_outcome` (`routes/api.php:401`) **and** `assertCollectionPartner` = resolved dept is a partner and owns the request (`Http/Controllers/TextileCollectionController.php:169-171,432-456`) | `textile.approve` (`:28-30`)                                                                            |
| T3  | `ready_to_group` \| `missed` → `scheduled`                              | `OperationsService.php:38-116`                 | all IDs exist under `lockForUpdate` (`:58-65`); one zone for whole batch (`:68-70`); status ∈ {ready_to_group, missed} (`:72-77`); date ≥ today, `window_end > window_start`, 1–250 IDs (`CreateCollectionBatchRequest.php:22-27`)                                                         | `textile.schedule_batch` (`api.php:389`) + partner check w/o request scope (`Controller.php:179`) — **zone is not checked against actor's department** (`Ops:68-70`)                                     | single `textile.schedule` with `entity_id = batch->id` (`Ops:104-108`); **per-request rows un-audited** |
| T4  | `scheduled` → `picked_up`                                               | `Ops:118-177` (`collected` branch `:134-139`)  | status == `scheduled` (`:181-183`); proof media `role='proof' AND is_replaced=false` exists else `PROOF_PHOTO_REQUIRED` 422 (`:128-130,198-213`); `actual_bags`/`actual_weight_kg` required (`RecordCollectionOutcomeRequest.php:23-24`)                                                   | `textile.record_outcome` (`api.php:404`) + ownership (`Controller.php:220`)                                                                                                                              | `textile.outcome` (`Ops:159-164`)                                                                       |
| T5  | `scheduled` → `missed`                                                  | `Ops:140-144`                                  | status == `scheduled` (`:182`); `reason` required (`Request:25`)                                                                                                                                                                                                                           | same as T4                                                                                                                                                                                               | `textile.outcome`; sets `batch_id=null` but keeps `scheduled_date/window` (`Ops:143`)                   |
| T6  | `pending_review` → `rejected`                                           | `Ops:145-149`                                  | status == `pending_review` **only** (`:183`); reason required                                                                                                                                                                                                                              | same as T4                                                                                                                                                                                               | `textile.outcome`                                                                                       |
| T7  | `pending_review`\|`ready_to_group`\|`scheduled`\|`missed` → `cancelled` | `Ops:150-154`, `:184-189`                      | staff path = T4 gate; citizen path additionally blocks `picked_up/cancelled/rejected` (`Controller.php:258-264`) and requires reason ≥5 chars (`:249-251`)                                                                                                                                 | staff (`api.php:404`) **or** owning citizen via `textile.cancel` (`api.php:444`, `Policy:47-50`)                                                                                                         | `textile.outcome` with citizen as actor (`Ops:159-164`)                                                 |

Unreachable / absent by design: `ready_to_group` → `rejected`; `scheduled` → `rejected`; `ready_to_group` → `picked_up` (must be scheduled first, `Ops:181-191`).

## ROUTES+ABILITY

All staff routes are inside `prefix('department')` group `api.php:325-329`. Gate names defined `Providers/TextileCollectionsServiceProvider.php:22-27`, provider registered `bootstrap/providers.php:21`; `super_admin`/`system` bypass + suspended/denied denial inherited `app/Modules/Shared/Policies/BasePolicy.php:29-51`.

| Route                                             | api.php | Ability                     | Policy fn                                                     |
| ------------------------------------------------- | ------- | --------------------------- | ------------------------------------------------------------- |
| GET `department/textile-collections`              | 385-387 | `textile.view_queue`        | `Policy:19-22` (any partner member)                           |
| POST `department/textile-collections/schedule`    | 388-390 | `textile.schedule_batch`    | `Policy:37-40`                                                |
| GET `department/textile-collections/report`       | 391-393 | `textile.report`            | `Policy:52-55`                                                |
| PUT `department/textile-zones/{zone}`             | 394-396 | `textile.schedule_batch`    | `Policy:37-40` + zone-owner check `Controller.php:541-553`    |
| GET `department/textile-collections/{collection}` | 397-399 | `textile.view,collection`   | `Policy:24-35`                                                |
| POST `.../{collection}/approve`                   | 400-402 | `textile.record_outcome`    | `Policy:42-45`                                                |
| POST `.../{collection}/outcome`                   | 403-405 | `textile.record_outcome`    | `Policy:42-45`                                                |
| POST `.../{collection}/proof`                     | 406-408 | `textile.record_outcome`    | `Policy:42-45`                                                |
| GET `textile-collection/zones`                    | 415-416 | none (auth only)            | — (category→capability filter `Controller:51-58`)             |
| POST `textile-collection/requests`                | 417-419 | none (auth only)            | —                                                             |
| GET `citizen/textile-collections`                 | 438-439 | none                        | — (self-filter `Controller:90-92`)                            |
| GET `citizen/textile-collections/{collection}`    | 440-442 | `textile.view,collection`   | `Policy:24-35` then stricter owner check `Controller:103-105` |
| POST `citizen/.../cancel`                         | 443-445 | `textile.cancel,collection` | `Policy:47-50`                                                |
| POST `citizen/.../photo`                          | 446-448 | `textile.view,collection`   | `Policy:24-35` + owner check `Controller:292-294`             |

Two parallel authorization mechanisms coexist: Gate abilities (`Policy::isCollectionPartner` `Policy:62-77`) **and** controller-side `assertCollectionPartner` (`Controller:432-456`, raw `textile_partner_capabilities` query at `:442-444`); the second, not the Gate, enforces per-request department ownership.

## NOTIFICATIONS

Listener wiring: `app/Providers/AppServiceProvider.php:71-74`. Templates: `database/seeders/NotificationTemplatesSeeder.php`.

| Transition   | Template                                | Channel                                              | Fired by                                                                                     |
| ------------ | --------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T1 create    | `textile.acknowledged` (`seeder:92-98`) | email (`Listener:46-48`)                             | `Service.php:95` → `Listeners/SendTextileAcknowledgmentOnCollection.php:39-48`               |
| T3 schedule  | `textile.scheduled` (`seeder:100-105`)  | **sms**, one per request in batch (`Listener:32-62`) | `Ops:112` → `SendTextileScheduledNotification.php:46-54`                                     |
| T4 collected | `textile.collected` (`seeder:108-113`)  | email                                                | `Ops:169` → `SendTextileCollectedNotification.php:41-49` (actual→estimate fallback `:36-37`) |
| T6 rejected  | `textile.rejected` (`seeder:116-121`)   | email                                                | `Ops:172-174` → `SendTextileRejectionNotification.php:39-46`                                 |

**Silent transitions:** T2 approve, T5 missed, T7 cancel — no event, no template (only 4 textile codes exist, `seeder:92-120`).
All four listeners swallow every `Throwable` into `Log::warning` (`Acknowledged:49-55`, `Scheduled:55-61`, `Collected:50-56`, `Rejected:47-53`) → delivery failure is invisible to API and audit.
`textile.scheduled` fires **inside** `DB::transaction` (`Ops:48` … `:112`), so SMS can be sent for a rolled-back batch.

## AUDIT

Writer: `OperationsService::audit()` `:219-236` → `AuditLog` with fixed `entity='textile_collection'`, `device_fingerprint=null`, `request_id` from `trace_id` (`:222,233`).

- `textile.approve` (`:28-30`) before `{status:pending_review}` / after `{status:ready_to_group}`.
- `textile.schedule` (`:104-108`) `before=null`, after `{service_zone_id, collection_date, request_count}` — but `entity_id` is the **batch** id while `entity` says `textile_collection` (`:104`).
- `textile.outcome` (`:159-164`) for T4/T5/T6/T7; logs `reason` free text.
- `textile.update_zone`, `entity='textile_service_zone'` (`Controller.php:570-584`).
- Photo uploads are audited only through media chain-of-custody, not AuditLog: `ChainOfCustodyWriter::record(..., EVENT_UPLOAD, ...)` `Services/TextileCollectionMediaService.php:152-160`.
- **No audit at all for:** T1 creation (`Service.php:72-97`), T3's individual request status changes (`Ops:92-102`), `scan_status` forced `CLEAN` bypassing quarantine (`MediaService.php:144`, documented `:22-24`), zone creation, proof count rejections.

## MIGRATIONS

Five textile migrations, all in `backend/database/migrations/`:

1. `2026_08_25_000100_create_textile_collection_tables.php` — `textile_service_zones` (`:14-30`, incl. `dropoff_enabled/name/address` `:21-24`), `textile_collection_batches` (`:32-49`, `status` default `'planned'` `:39`, `trip_reference` string 64 `:40`), `textile_collection_requests` (`:51-85`, `report_id` NOT NULL+unique FK `:53,78`, `batch_id` `nullOnDelete` `:80`), MySQL engine/charset loop `:87-95`.
2. `2026_08_25_000300_decouple_textile_collections_from_complaints.php` — adds `citizen_id, reference, title, notes, latitude, longitude, submitted_at` (`:14-22`); backfill from reports + `DLN-<year>-<seq>` refs (`:24-51`); citizen FK, unique `reference`, `[citizen_id,created_at]` index (`:53-57`); `report_id` → nullable (`:61-67`); deactivates report type `clothes_waste` (`:72-74`).
3. `2026_08_26_000100_make_textile_volume_estimates_optional.php` — `estimated_bags`/`estimated_weight_kg` nullable (`:19-22`).
4. `2026_08_27_000100_add_textile_collection_id_to_media_table.php` — `media.textile_collection_id` FK `nullOnDelete` + `media_textile_collection_idx`; `media.report_id` nullable (`:23-35`).
5. `2026_08_28_000100_add_partner_columns_to_textile_tables.php` — `textile_partner_capabilities` (`:15-23`), `zones.department_id` (`:26-30`) + DR_LINEN backfill (`:32-39`), `requests.category`+`department_id` (`:42-47`) + backfill (`:49-58`), DR_LINEN capability seed (`:60-76`). **Defect:** `Str::uuid()` at `:70` with no `use Illuminate\Support\Str;` import (imports `:5-8`) → fatal `Error: Class "Str" not found` whenever `DR_LINEN` is missing at `:61`.

No migration anywhere defines drop-off centres, receipts, drivers, teams, vehicles, stop ordering, or a batch-status enum.

## GAPS-DROPOFF

1. **No drop-off-specific state.** `dropoff` exists only as `collection_method` (`StoreTextileCollectionRequest.php:38`; gate `Service.php:37-39`); both methods share the one machine, so a citizen who drops off must still be scheduled into a trip and "collected" — `collected` is legal only from `scheduled` (`Ops:181-191`). No `dropped_off`/`received_at_centre`/`weighed` status.
2. **No centre entity.** Drop-off is 2 denormalized strings on the zone (`migration 000100:23-24`; `TextileServiceZone.php:26-27`). No centre table, code, hours, capacity, contact, geo-fence, or staff roster; no FK from request → centre (columns list `TextileCollectionRequest.php:80-89`).
3. **No receipt artifact.** No receipt number / `received_at` / `received_by` / centre weight columns anywhere; the API exposes only `zone.dropoff_name/address` (`TextileCollectionResource.php:53-59`) and there is no receipt endpoint in `routes/api.php`.
4. **No centre-scoped authorization.** Policy has no receive/receipt ability (`Policy:19-55`); every write gate is partner-wide (`Policy:42-45`) and ownership is only `department_id` equality (`Controller:451-453`) — one partner user can act on every zone/centre of that partner.
5. **Media roles can't express a receipt.** Only `evidence` and `proof` are produced (`MediaService.php:82-99`), proof capped at 3 (`:31,182-198`); `collected` hard-requires a `proof` photo (`Ops:128-130,198-213`), so a centre-weighed receipt cannot replace photo proof.
6. **Zone drop-off config is barely editable and unverified.** `updateZone` accepts only `dropoff_name`/`dropoff_address` (`Controller:555-568`) — cannot toggle `dropoff_enabled`, hours, or `active`; seeded values are placeholders ("configure the verified address before production use", `TextileCollectionsSeeder.php:66-67,86-87`).
7. **No notification path** for receipt issuance or drop-off reminder (only 4 templates, `NotificationTemplatesSeeder.php:92-120`).
8. **Stale schedule data on cancel/miss** — `batch_id` nulled but `scheduled_date`/window retained (`Ops:143,148,153`), so a cancelled drop-off request still renders a pickup window (`TextileCollectionResource.php:44-46`).
9. **Test coverage:** `tests/Feature/TextileCollections/` has only `TextileCollectionFlowTest` (create/approve/schedule/collect `:115`, citizen cancel `:156`), `TextileCollectionPhotoTest`, `TextileCollectionZonesTest` — no drop-off-receipt test.

## GAPS-TRIP

1. **No driver/team/vehicle identity on a trip.** Batch columns are `service_zone_id, reference, collection_date, window_start/end, status, trip_reference, instructions, created_by` (`migration 000100:32-49`, `TextileCollectionBatch.php:30-33`); `trip_reference` is free text max 64 (`CreateCollectionBatchRequest.php:27`) with no uniqueness.
2. **Batch lifecycle frozen.** `'planned'` is the only status ever set (`Ops:86`) and the only default (`migration:39`); no constants, no route, no service method, no event for `planned → in_progress → completed/cancelled` — every finished trip still reports `status: "planned"` (`Controller:209`, `TextileCollectionResource.php:66`).
3. **No trip-execution endpoints.** `routes/api.php` offers only queue/schedule/report/outcome/proof (`:385-408`): no trip list, no start/close, no stop sequence, no arrival/departure or geofence capture, no manifest, no offline sync.
4. **Dispatch is simulated in the browser.** The operations page groups stops client-side by `batch reference ?? trip_reference ?? 'Unassigned trip'` (`frontend/src/portals/operations/pages/textile/TextileDispatchPage.tsx:168-175`) and the client calls only list/zones/schedule/report (`frontend/src/portals/operations/api/textileApi.ts:65,77,91,142`) — no server trip model behind it.
5. **Cross-partner scheduling hole in T3.** Gate is partner-generic (`Policy:37-40`), `schedule` runs `assertCollectionPartner` **without** a collection (`Controller:179`), and the batch guard compares only `service_zone_id` (`Ops:68-70`) — never `department_id` — so a partner can pull another partner's requests into its trip in a shared zone.
6. **No atomicity for execution.** `recordOutcome` performs status update, audit and event with no `DB::transaction` (`Ops:126-177`), unlike `scheduleBatch` (`Ops:48`). Only `scheduleBatch` row-locks (`Ops:60`).
7. **Trip audit trail unusable.** One `textile.schedule` row keyed to the batch id under `entity='textile_collection'` (`Ops:104-108`); the per-request status writes (`Ops:92-102`) generate no audit rows → stop-level history is unreconstructable.
8. **No trip planning constraints.** No overlap/uniqueness guard for two batches in the same zone+date, no per-day capacity or zone/vehicle limit, no `collection_date` sanity beyond "today or later" (`CreateCollectionBatchRequest.php:24`).
9. **No way to unwind a planned trip.** No cancel/delete endpoint; because `batch_id` is `nullOnDelete` (`migration 000100:80`) a removed batch leaves requests stuck in `scheduled` with no reverse path (`Ops:182` requires `scheduled` for collected/missed).
10. **Report miscounts trips** — `collection_trips` counts batches having ≥1 request of the caller's department (`Controller:385-388`), independent of actual trip completion, and `trip_reference` is unconstrained/duplicable.
11. **Citizen cancel silently drops a scheduled stop** without any batch recalculation, driver notification, or template (T7, `Ops:150-154`; no listener).
12. Fixing 1–3 requires new migrations only (never editing `000100`/`000300`, per `AGENTS.md`), plus new module-scoped Gate abilities (e.g. `textile.assign_trip`, `textile.execute_trip`) to avoid clobbering other modules' abilities (`AGENTS.md` Architecture Constraints; pattern at `TextileCollectionsServiceProvider.php:22-27`).
