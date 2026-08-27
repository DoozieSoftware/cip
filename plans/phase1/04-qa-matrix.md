# QA/Acceptance Test Matrix — Textile Collection Phase 0–2

Scope: Phase 1 drop-off receipt + Phase 2 trip execution (`plans/textile-collection-next-phases.md:42-160`) on the shipped engine (`backend/app/Modules/TextileCollections/`). Transitions: **R** dropoff receipt (new), **A** trip assign (new), **O** stop reorder (new), **C** collect/miss (exists, `TextileCollectionOperationsService.php:118-177`), **X** cancel (exists) / reschedule (Phase 3, matrix reserved).
Already green today: Flow/Photo/Zones Pest (`backend/tests/Feature/TextileCollections/*.php`), Vitest (`TextileDispatchPage.test.tsx`, `shared.test.tsx`, `TextileCollectionFields.test.tsx`, `TextilePhotoFeatures.test.tsx`). **No textile e2e spec exists** (`frontend/e2e/` has none). No decision registry `D-01..D-08` exists in-repo; IDs assigned here from Phase 0 bullets `plans/textile-collection-next-phases.md:47-56`.

## BACKEND_MATRIX

Legend: P=pytest/Pest target, new=needs new test, ext=extend existing file. Gate abilities: `TextileCollectionsServiceProvider.php:22-27`; audit helper `TextileCollectionOperationsService.php:219-236`.

| ID    | Transition      | Case               | Assertion                                                                                                                                                                                                           | Pest target                                                                                                        |
| ----- | --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| BE-R1 | dropoff receipt | happy              | receipt records qty/weight/proof → status `received` (not `picked_up`); 201                                                                                                                                         | new `DropoffReceiptTest.php`                                                                                       |
| BE-R2 | dropoff receipt | authz neg          | driver-role staff without `textile.receive` → 403; other-partner counter staff → 403                                                                                                                                | new, mirror `TextileCollectionPhotoTest.php` 403 pattern                                                           |
| BE-R3 | dropoff receipt | idempotency        | same Idempotency-Key replayed → single receipt row, single audit, 200 not 409                                                                                                                                       | new; reuse `Shared/Http/Middleware/IdempotencyKey.php` (currently reports-only, `routes/api.php:385-448` has none) |
| BE-R4 | dropoff receipt | double-submit race | two concurrent receipts w/o key → exactly one wins, other 422 "already received"                                                                                                                                    | new                                                                                                                |
| BE-R5 | dropoff receipt | media              | no proof → 422 `PROOF_PHOTO_REQUIRED` (cf. `OperationsService.php:198-213`); non-image → 422; >10MB → 422 (`UploadTextilePhotoRequest.php:31-32`); 4th proof → 422 (`TextileCollectionMediaService.php:31,190-195`) | ext `TextileCollectionPhotoTest.php`                                                                               |
| BE-R6 | dropoff receipt | notif suppression  | receipt notif once; none if citizen opted out email / request cancelled mid-flight                                                                                                                                  | new; hook `NotificationPreferenceService`                                                                          |
| BE-R7 | dropoff receipt | audit              | `AuditLog` row action `textile.receive`, before/after status, actor, request_id                                                                                                                                     | new                                                                                                                |
| BE-R8 | dropoff routing | dropoff≠trip       | `scheduleBatch` rejects a dropoff request → validation fail                                                                                                                                                         | ext `TextileCollectionFlowTest.php`                                                                                |
| BE-A1 | trip assign     | happy              | assign driver+vehicle to batch → batch updated, audit `textile.assign`                                                                                                                                              | new `TripExecutionTest.php`                                                                                        |
| BE-A2 | trip assign     | authz neg          | non-partner staff 403; driver cannot self-assign; citizen 401/403                                                                                                                                                   | new                                                                                                                |
| BE-A3 | trip assign     | idempotency        | same assignment twice → one audit row, no dup                                                                                                                                                                       | new                                                                                                                |
| BE-A4 | trip assign     | lost-update        | assign v1 vs v2 concurrent (If-Match/updated_at or lock) → one rejected 409/422                                                                                                                                     | new                                                                                                                |
| BE-O1 | reorder         | happy              | stop order persists; manifest read returns order                                                                                                                                                                    | new                                                                                                                |
| BE-O2 | reorder         | authz neg          | driver from other trip/partner → 403                                                                                                                                                                                | new                                                                                                                |
| BE-O3 | reorder         | idempotency        | resubmit identical order → no dup audit churn, stable order                                                                                                                                                         | new                                                                                                                |
| BE-O4 | reorder         | lost-update        | two staff reorder same trip → last-write-wins forbidden; versioned order column, stale submit 409                                                                                                                   | new                                                                                                                |
| BE-C1 | collect/miss    | happy              | ext exists `TextileCollectionFlowTest.php` "lets Dr. Linen review group schedule and complete"                                                                                                                      | ext                                                                                                                |
| BE-C2 | collect         | authz neg          | driver not on trip → 403 (Phase 2 tightens `textile.record_outcome`, `TextileCollectionPolicy.php:42`)                                                                                                              | new                                                                                                                |
| BE-C3 | collect         | idempotency        | double POST `/outcome` collected → 2nd 422 (status guard `OperationsService.php:179-195`); with Idempotency-Key → replay-safe                                                                                       | ext FlowTest                                                                                                       |
| BE-C4 | collect         | lost-update        | staff A collected ∥ staff B missed, pre-fix race has NO row lock in `recordOutcome` (contrast `scheduleBatch` lock `OperationsService.php:58-61`) → assert exactly one terminal outcome                             | new — **findings test, expected to fail until lock added**                                                         |
| BE-C5 | miss            | happy+re-entry     | missed clears `batch_id` (line 140) then re-schedulable (allowed at `:74-78`)                                                                                                                                       | ext                                                                                                                |
| BE-X1 | cancel          | happy              | exists (`Controller.php:240-278`); audit check new                                                                                                                                                                  | ext FlowTest                                                                                                       |
| BE-X2 | cancel          | authz neg          | other citizen 403 — covered `TextileCollectionFlowTest.php` "allows only the owning citizen to cancel"                                                                                                              | done                                                                                                               |
| BE-X3 | cancel          | idempotency        | double cancel → 2nd 422 (`Controller.php:260-266`)                                                                                                                                                                  | ext                                                                                                                |
| BE-X4 | cancel          | race               | cancel ∥ collect same request → exactly one terminal state                                                                                                                                                          | new (same gap as BE-C4)                                                                                            |
| BE-X5 | reschedule      | full matrix        | deferred: Phase 3 (`plans/…:163-185`); reserve IDs, gated by D-04                                                                                                                                                   | —                                                                                                                  |
| BE-M1 | migration       | backfill           | new migration keeps all 5 existing textile migrations untouched; existing requests backfill: dropoff rows keep status, batches stay `planned`; `category`/partner default per `2026_08_28_000100` precedent         | new `TextileCollectionsMigrationTest.php`                                                                          |
| BE-M2 | migration       | receipt backfill   | legacy completed dropoffs (currently `picked_up` via shared flow) → mapping per D-03 approved rule                                                                                                                  | new ⛔D-03                                                                                                         |
| BE-N1 | notif           | all events         | collected/rejected listeners fire once (`OperationsService.php:170-176`); missed/cancel currently dispatch **no** event → acceptance gap per Phase 1 §"dedicated lifecycle events"                                  | new                                                                                                                |

## FRONTEND_MATRIX

| ID    | Surface                                   | Case                                                                      | Vitest target                     |
| ----- | ----------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| FE-R1 | new `DropoffReceiptPage` (counter desk)   | states: loading/empty/error; find-by-reference; submit disabled w/o proof | new `DropoffReceiptPage.test.tsx` |
| FE-R2 | citizen `TextileCollectionDetailPage.tsx` | dropoff shows centre/hours/reference, never "trip scheduled" copy         | ext `pages/__tests__/`            |
| FE-R3 | `TextileSchedulePage.tsx`                 | approved dropoff requests absent from trip candidate list                 | ext `shared.test.tsx`             |
| FE-A1 | new trip-manifest page                    | assign UI hidden without gate; driver sees own trips only                 | new ⛔D-05 (role names)           |
| FE-A2 | manifest reorder                          | up/down commits, optimistic revert on 409                                 | new ⛔D-06                        |
| FE-C1 | `TextileDispatchPage.test.tsx`            | exists (proof picker); add double-click submit → single POST              | ext                               |
| FE-X1 | citizen cancel                            | confirm dialog + disabled after picked_up/cancelled/rejected              | new                               |
| FE-E1 | every new screen                          | explicit loading/empty/error states (AGENTS.md frontend rule)             | each new test file                |

## E2E_JOURNEYS

New `frontend/e2e/textile-*.spec.ts` (Chromium, Vite :5173 per AGENTS.md; needs queue+scheduler for notifications).

| ID    | Journey                   | Steps                                                                                  | Key asserts                                                |
| ----- | ------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| E2E-1 | drop-off happy            | citizen books drop-off → approval → counter receipt w/ photo → citizen sees "received" | no trip steps offered; before/after proof visible          |
| E2E-2 | drop-off rejected walk-in | reject path; reason shown                                                              | audit trail in staff desk                                  |
| E2E-3 | pickup trip               | approve → schedule → assign driver → reorder stops → collect w/ proof                  | manifest on 375px viewport (Phase 2 AC, `plans/…:152-158`) |
| E2E-4 | miss→reschedule loop      | mark missed → re-enter schedule queue → collect on trip 2                              | batch_id detach/re-attach                                  |
| E2E-5 | citizen cancel mid-trip   | cancel while staff opens manifest                                                      | one side wins, other shows conflict copy                   |
| E2E-6 | cross-partner isolation   | DEMO_EWASTE staff cannot open Dr. Linen trip URLs                                      | redirect/403, no data leak                                 |

## NEGATIVE_CASES

- AuthN: 401 unauth on all new endpoints (pattern `TextileCollectionZonesTest.php:rejects an unauthenticated`).
- AuthZ: citizen→staff endpoints 403; partner-A→partner-B UUIDs 403/404; driver-not-assigned→stop actions 403 (⛔D-05).
- Dropoff-in-trip & pickup-at-counter cross-use blocked (`plans/…:104-106`).
- Media: mime spoof (rename .php→.jpg) blocked via `MimeValidator` (`TextileCollectionMediaService.php:49,75`); >10MB; >3 proof; GIF (not in `mimes:jpeg,png,webp`).
- Validation: negative/zero qty (`RecordCollectionOutcomeRequest.php:23-25`); below-minimum kg (covered: FlowTest "rejects a below-minimum"; magnitude-bypass via `estimated_bags` alone still open — regression test for it).
- Terminal-state mutation: approve/collect/receive after cancelled|rejected|picked_up → 422.
- Notification suppression: preference-off, consent withdrawn, terminal-status requests, duplicate event dispatch → max 1 send.
- Zone ownership: `updateZone` clear-vs-null gap (`?? $zone->dropoff_name`, `plans/dr-linen-partner-roadmap.md:158`) — assert documented behavior.

## CONCURRENCY_TESTS

All Pest, MySQL service in CI (SQLite `:memory:` can't prove row locks — run under CI MySQL only):

1. **CC-1** collect ∥ miss same request (BE-C4): `recordOutcome` lacks `lockForUpdate`/version check (unlike `scheduleBatch:58-61`) → expect 1 terminal state, 1 notification, 1 audit chain.
2. **CC-2** cancel ∥ collect (BE-X4).
3. **CC-3** double receipt same reference (BE-R4) — unique constraint or guard.
4. **CC-4** batch schedule of same request from two desks → lock already present; assert single batch membership.
5. **CC-5** stale reorder submission vs committed order → 409 (⛔D-06 for ordering model).
6. **CC-6** stale assignment submission (BE-A4, ⛔D-05).
7. **CC-7** double POST citizen photo → single active (`is_replaced`) chain (ext PhotoTest "replaces the previous").
8. **CC-8** (Phase 4 preview, document only) offline retry idempotency — out of Phase 0-2.

## BLOCKED_BY_DECISIONS

Phase 0 has no approved answers yet (`plans/textile-collection-next-phases.md:41-73`; "No Phase 1 schema… until approved" `:293`). IDs mapped to decision bullets at `:47-56`.

| ID   | Decision (line)                                        | Blocked tests                                                                             |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| D-01 | Drop-off reservation vs walk-in (`:47`)                | BE-R1/R3 shape, E2E-1 (reference lookup), FE-R1                                           |
| D-02 | Ack contents: QR/ref/hours (`:48`)                     | BE-R1 payload, FE-R2 render asserts, E2E-1 QR step                                        |
| D-03 | Receipt role rule: counter/driver/both (`:49`)         | BE-R2, BE-C2 (counter-flow exclusion), BE-M2, E2E-6                                       |
| D-04 | Reschedule cutoff + override (`:50`)                   | BE-X5 entire row, E2E-4 override branch                                                   |
| D-05 | Who assigns driver/team/vehicle (`:51`)                | BE-A1..A4, CC-6, FE-A1                                                                    |
| D-06 | Stop-ordering model (`:52`)                            | BE-O1..O4, CC-5, FE-A2                                                                    |
| D-07 | Pickup vs drop-off quantity eligibility (`:53`)        | validation negatives (min-kg route rule), routing asserts in E2E-1                        |
| D-08 | Field capture set: photo/ts/location/signature (`:54`) | BE-R5/BE-C media-field matrix, offline storage shape (Phase 4 preview), privacy negatives |

**Unblocked now:** BE-C1/C3/C5, BE-X1..X3, BE-M1, CC-1..CC-4, CC-7, FE-C1, FE-X1, all NEGATIVE_CASES not tied to D-IDs, e2e scaffold E2E-4 (miss loop uses shipped states only).
**Not blocking Phase 0-2:** reminder channels (`:55`) and capacity dims (`:56`) — Phase 3/5 consumers.
