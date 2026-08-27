# Ops UX Spec — Centre Receipt + Trip Execution (Dr. Linen / partner desk)

Scope audited: `frontend/src/portals/operations/pages/textile/*`, `api/textileApi.ts`, routes `OperationsApp.tsx:56-61`, nav `layout/OperationsLayout.tsx:100-106`, backend `TextileCollections` module.

**Audit baseline (what exists today)**

| File                         | Today                                                                     | Gap for this spec                                                                    |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `TextileReviewPage.tsx`      | table of `pending_review`, bulk approve (`:44-51`)                        | method-blind (`:191` label only)                                                     |
| `TextileSchedulePage.tsx`    | `ready_to_group` grouped by zone, one-zone lock (`:80-84`)                | no driver/team/vehicle, no stop order                                                |
| `TextileDispatchPage.tsx`    | `scheduled` grouped by batch (`:168-185`), photo+bags+weight (`:287-395`) | no assignment UI, no call/navigate, no per-stop queue                                |
| `TextileCompletedPage.tsx`   | history table                                                             | chips set `statusFilter` (`:32`) but query is hardcoded (`:35-45`) → **dead filter** |
| `TextileStaffDetailPage.tsx` | request detail + reject + zone drop-off edit (`:175-181`)                 | back link hardwired to `/review` (`:51-57`)                                          |
| `shared.tsx`                 | 15 exports, 373 lines, 5 consumers                                        | mixed concerns (see FILE_OWNERSHIP)                                                  |

---

## QUEUE_SPLIT

Two physically different workflows share one queue today; dispatch only reads `status=scheduled` (`TextileDispatchPage.tsx:63`), so **drop-off requests that arrive at a centre have no screen**.

Split on `collection_method` (`api/textileApi.ts:19`, labels only in `TextileReviewPage.tsx:191`, `TextileSchedulePage.tsx:251`):

| Queue             | Method     | Path                                                | Desk                           |
| ----------------- | ---------- | --------------------------------------------------- | ------------------------------ |
| A. Centre receipt | `dropoff`  | `ready_to_group` → receipt → `picked_up` (no batch) | **new** `TextileReceiptPage`   |
| B. Trip execution | `premises` | `ready_to_group` → schedule → assign → dispatch     | Schedule + Dispatch (extended) |

Contract gap: `index()` filters status/zone/category/search only (`TextileCollectionController.php:112-146`) — add `collection_method` to the list endpoint and to `fetchTextileQueue` (`shared.tsx:85-115`) / `QueueArgs`.

Interim (frontend-only, no backend change): a segmented control in the toolbar filters client-side; label it clearly as a view filter, since paging is server-side (`PER_PAGE = 25`, `shared.tsx:12`) and counts would mislead. Prefer the query param.

Component changes:

- `shared.tsx`: new `MethodFilter` (mirrors `ZoneFilter` `shared.tsx:201-224`), `QueueArgs.collection_method`; extend `useDesk` to gate on `is_collection_partner` instead of literal `code === 'DR_LINEN'` (`shared.tsx:47-49`) to match `OperationsLayout.tsx:112-118`.
- `TextileReviewPage.tsx`: add `MethodFilter`; render method as a `MethodBadge` (new, next to `CategoryBadge` `shared.tsx:250`) with drop-off point name (`service_zone.dropoff_name`) so reviewers see _where_ the citizen goes.
- `TextileSchedulePage.tsx`: `status=ready_to_group` + `collection_method=premises`; hide drop-off rows rather than disabling them.
- `TextileDispatchPage.tsx`: keep `scheduled`+premises; drop-off rows never appear.
- `TextileCompletedPage.tsx`: fix dead filter — pass `status: statusFilter` into `useTextileQueue`.

---

## RECEIPT_SCREEN

`pages/textile/TextileReceiptPage.tsx` (new). Legal today: `collected` is accepted from `ready_to_group` (`TextileCollectionOperationsService.php:185-189`) and proof-photo enforcement already exists (`:200-215`), so no new state is required.

Layout (desktop 2-col: 380px search rail + work card; mobile single column, card fills viewport).

1. **Find** — one oversized input, autofocus, `inputMode="text"`, placeholder "Scan QR or type DL-… / phone". Submits exact-match search. Reuse `SearchBox` (`shared.tsx:168`) widened to `max-w-none`. Backend search already covers `reference`, `requester_name`, `contact_phone`, `title` (`TextileCollectionController.php:134-142`); **no QR endpoint exists** (grep: no `qr_code`/`barcode` in app or DB) → scan must resolve to a reference.
2. **Verify record** — read-only strip before any input: reference, requester, phone last-4 match prompt, zone, category, drop-off point name+address (`service_zone.dropoff_*`), **estimated vs to-be-entered actual** (`formatVolume` `shared.tsx:66-70`), status chip (`StatusBadge` `shared.tsx:362`). States: not found / already received (shows `picked_up_at` + who, blocks re-receipt) / wrong zone for this desk.
3. **Weigh + count** — `Actual bags` (integer, `min=1`) and `Actual weight (kg)` (`step=0.1`), both `min-h-12` touch targets, copy the dispatch inputs (`TextileDispatchPage.tsx:289-305`). Live variance line: `actual − estimated`, amber ≥25 %, red ≥50 % or negative; **variance requires a reason** even when collecting.
4. **Photo** — one proof photo, required. Keep the existing validation rules verbatim (JPEG/PNG/WebP, ≤10 MB — `TextileDispatchPage.tsx:24-31`) and lift `validatePhotoFile` into `shared.tsx` so receipt + dispatch cannot drift.
5. **Reason** — select + optional note; reasons: `quantity_mismatch`, `wrong_material`, `outside_zone`, `damaged_wet`, `no_show_at_centre`, `other`. Maps to existing `reason` field of `recordTextileOutcome` (`textileApi.ts:96-113`); "reject at counter" path = `outcome:'rejected'` + reason (already reachable, `TextileStaffDetailPage.tsx:206-224`).
6. **Commit** — "Confirm receipt". Same two-step order as dispatch (photo first, then outcome — `TextileDispatchPage.tsx:137-163`) and same `PROOF_PHOTO_REQUIRED` handling; but on failure the card must **retain all entered values** (dispatch resets via `resetPhotoState` only on success). Audit is server-side (`audit(...)` in `TextileCollectionOperationsService.php:28,104,158-163`); show a receipt confirmation carrying reference, actuals, reason, time.

Audit-visible fields to surface post-commit: actor, timestamp, actual bags/weight, reason — via `AuditLogPage.tsx` today, inline in the card thereafter.

---

## TRIP_SCREEN

Extend `TextileSchedulePage.tsx` into a two-step desk: **1 Build manifest → 2 Assign & dispatch**. Keep `scheduleTextileBatch` (`textileApi.ts:74-88`) for step 1; step 2 needs an assignment endpoint that **does not exist** (`trip_reference` is free text only, migration `2026_08_25_000100_create_textile_collection_tables.php:39`).

Required backend before build (blocking, see OPEN_QUESTIONS): `batch.assign` with `driver_user_id | team_id | vehicle_id`, plus `stop_order` per request.

Screen sections:

1. **Manifest builder** — existing zone grouping (`:176-256`) gains drag-reorder (or ↑/↓ buttons for touch/a11y), running totals already present (`:130-133` bags), plus estimated weight, ETA-per-stop, and stop count vs crew capacity.
2. **Assignment panel** — three required selects (driver, team, vehicle) rendered with `Select` from `shared/ui` (barrel exports `Select`, `shared/ui/index.ts:5`), each with empty/error state; vehicle capacity check against manifest weight with inline warning.
3. **Trip card / board** (`TextileDispatchPage.tsx`): replace the batch-label grouping keyed on a display string (`:224` `key={label}` — collides when two batches share reference+date) with `key={batch.id}`; header gains driver name, phone, vehicle reg, progress `n/m stops`, `planned|in_progress|completed` chip (`STATUS_STYLES` pattern `shared.tsx:31-36`).
4. **Progress + actions per stop** — `tel:` link (`IconPhone`) and maps deep link (`IconNavigation`, `geo:` on Android / `https://maps.apple.com` fallback / `maps://` iOS via UA check); "Arrived", "Record collection", "Mark missed". Call/navigate are logged client-side only unless backend adds stop events — do **not** claim GPS verification in copy.
5. **Concurrency** — keep `autoRefresh` pause semantics (`shared.tsx:78-80,108-112`; test `shared.test.tsx:23-46`) and extend the pause predicate to `assignmentOpen || expandedId !== null || missedTarget !== null`, so a 30 s poll cannot wipe a half-entered weight.
6. **Per-stop state isolation** — dispatch currently holds one global `bags`/`weight`/photo state (`TextileDispatchPage.tsx:38-42`), so opening stop B clobbers stop A. Extract `StopRow` + `StopRecordForm` with local state (props: `item`, `onSubmit`, `busy`) — prerequisite for a manifest UI.

---

## MANIFEST_MOBILE

Mobile is the field surface (bottom nav already exists, `OperationsLayout.tsx:256` + `pb-28` main padding `:249`). Tables are not usable — `TableShell` forces `min-w-[820px]` (`shared.tsx:260-279`); the trip/manifest views must be card lists like `TextileDispatchPage.tsx:224-246`, never a `TableShell`.

Stop card (mobile, in manifest order):

```
┌──────────────────────────────────────────┐
│ ● 3  AR  ──────────────  [ 6 of 14 ]     │  order pill + status chip
│ DL-24-0917 · Clothes            est 4/32kg│  mono ref (text-[11px]), CategoryBadge
│ Shalini Residency, 5th Cross, HSR L2      │  2-line clamp, address
│ ─────────────────────────────────────────│
│ [ 📞 Call ]        [ 🧭 Navigate · 2.4km ] │  min-h-12, each ≥44×44
│ ─────────────────────────────────────────│
│ bags [  4 ]  kg [ 32.0 ]   [ 📷 photo ]   │  open form (inline, not modal)
│ ⚠ +2 bags vs estimate — reason required  │
│ [ ✓ Confirm collected ]   [ Mark missed ] │  sticky bottom action bar
└──────────────────────────────────────────┘
```

Rules: touch targets ≥44 px (design system `docs/13-UI-Design-System.md:805`); confirm action in a sticky bar with `env(safe-area-inset-bottom)` (pattern at `OperationsLayout.tsx:256`); one-stop-at-a-time expansion; completed cards collapse to a single grey line and drop below a "12 done" divider; trip header (driver/vehicle/progress) sticky under the page header; offline-safe copy — the two-step upload has no queue, so show "requires connection" rather than implying offline capture.

---

## FILE_OWNERSHIP

`shared.tsx` (373 lines, 15 exports, 5 consumers) must not absorb receipt/trip code. Split, one owner each:

| File (proposed)                 | Sole owner of                                                                                                             | Moves out of                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `textile/shared.tsx`            | desk gating + queue hook + labels (`:12-115`)                                                                             | components below                                 |
| `textile/queueControls.tsx`     | `SearchBox`, `ZoneFilter`, `CategoryFilter`, `MethodFilter`, `DeskPage`, `DeskStates`, `Pager`, `TableShell` (`:124-361`) | `shared.tsx`                                     |
| `textile/badges.tsx`            | `StatusBadge`, `CategoryBadge`, new `MethodBadge`, `VarianceBadge` (`:250-258,362-373`)                                   | `shared.tsx`                                     |
| `textile/photoCapture.ts`       | `validatePhotoFile`, `MAX_PHOTO_BYTES`, `ALLOWED_PHOTO_TYPES`                                                             | `TextileDispatchPage.tsx:24-31`                  |
| `api/textileApi.ts`             | all textile DTOs + endpoints (single barrel) — add `assignTextileTrip`, `receiptQuery`, `collection_method` param         | —                                                |
| `TextileReceiptPage.tsx`        | receipt flow only                                                                                                         | new                                              |
| `components/StopRecordForm.tsx` | bags/weight/photo/reason form, reused by Dispatch + Receipt                                                               | extracted from `TextileDispatchPage.tsx:287-395` |

Enforcement: existing `shared/ui/ownership.test.ts` only forbids `portals/*/design` barrels — it will **not** catch this drift. Add a textile-scoped test asserting `shared.tsx` ≤ N lines / exports ≤ 8, and that no page imports another page. Do not import `CameraCapture` from `portals/citizen/components/CameraCapture.tsx` (citizen-owned, live-capture-only by design, `:11-14`); ops keeps `capture="environment"` (`TextileDispatchPage.tsx:319`). Any new primitive (BottomSheet, SegmentedControl, StatTile) goes to `shared/ui` and its barrel (`shared/ui/index.ts`), since `ownership.test.ts:60-77` requires shared/ui to own portal-consumed primitives.

---

## PERMISSIONS

Existing abilities (`TextileCollectionsServiceProvider.php:22-27`, routes `routes/api.php:385-408`): `textile.view_queue`, `textile.view`, `textile.schedule_batch`, `textile.record_outcome`, `textile.cancel`, `textile.report`. All partner-gated by capability row (`TextileCollectionPolicy.php:62-70`).

| Screen / action                            | Ability                                         | Reuse?                                                 |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------ |
| Receipt find + record actuals/photo/reason | `textile.record_outcome`                        | yes (proof+outcome already enforced server-side)       |
| Receipt history/audit strip                | `textile.view_queue`                            | yes                                                    |
| Build manifest, edit drop-off point        | `textile.schedule_batch`                        | yes (`updateZone` shares it, `routes/api.php:394-396`) |
| Assign driver/team/vehicle                 | `textile.assign_trip`                           | **new**; keep `schedule_batch` for manifest creation   |
| Confirm arrival / resequence stops         | `textile.record_outcome`                        | yes                                                    |
| Cancel trip / bulk reassign                | `textile.assign_trip` + role `department_admin` | new                                                    |

Client nav gating stays capability-driven (`OperationsLayout.tsx:112-118`), not code-literal. New gate must use a module-qualified name (`textile.*`) — global Gate names collide across `Report`-sharing providers (AGENTS.md architecture constraint). Phone numbers: recipient-only; mask middle digits in list views, reveal on Call tap (anti-fraud spec `docs/11`).

---

## OPEN_QUESTIONS

1. **No assignment model.** Batch has `trip_reference` free text only (`migration 2026_08_25_000100:39`); no driver/team/vehicle FK, no `vehicles`/`teams` table found in `database/migrations`. Backend contract needed before TRIP_SCREEN step 2 is buildable — or is assignment out of scope for this portal and owned by an external fleet system via `docs/12` connector framework?
2. **QR does not exist anywhere** in backend, DB, or frontend. Is the "QR" a printed/pasted label whose payload _is_ `reference` (cheap), or a signed token (needs issuance, rotation, anti-forgery per `docs/11`)? Interim: search by reference + phone-last-4 verify.
3. **Stop order** — new `stop_order` column on `textile_collection_requests`, or derived (window → zone → manual)? Manual reorder implies per-trip persistence.
4. **Centre identity.** Receipts are attributed to zone `dropoff_name/address` (editable per request's zone, `TextileStaffDetailPage.tsx:175-181`) — a mutable string. Do we need an immutable `textile_centres` table so historical receipts don't silently change meaning?
5. **Drop-off state machine.** Should `dropoff` requests ever enter `scheduled`, or does receipt skip straight to `picked_up` (server already permits, `TextileCollectionOperationsService.php:185-189`)? Affects `STATUS_LABELS` (`shared.tsx:15-24`) and the "Awaiting receipt" count officers expect.
6. **Weight tolerance thresholds** (25 % / 50 % proposed here) — is there an agreed figure in product decisions (`docs/mom-product-decisions.md`) or does the partner contract define it?
7. **Atomicity.** Photo upload then outcome is two calls (`TextileDispatchPage.tsx:143-149`); an interrupted receipt leaves an orphan proof. Accept, or add a single multipart receipt endpoint?
8. Manifest capacity/ETA data (vehicle capacity, per-stop ETA) has no source — invent nothing; confirm whether these numbers exist in partner ops or must be entered manually per trip.
