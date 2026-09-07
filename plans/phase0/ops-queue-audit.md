I have enough grounded context. Note up front: `TextileStopDetailPage.tsx` **does not exist** in the repo — the detail route `textile-collections/:id` resolves to `TextileStaffDetailPage.tsx`. That absence is itself a core finding. Backend confirms a single shared status machine, no `collection_method` queue filter, and no driver/vehicle/team/manifest/receipt columns.

---

# Textile Partner Desk Audit — DROP-OFF request vs DRIVER TRIP

## QUEUE-MAP

Today there is **one status machine for both premises pickups and drop-offs** (`TextileCollectionRequest::STATUS_*`). Queues are keyed **only by `status`** (`shared.tsx › useTextileQueue` → `fetchTextileQueue`), and the backend index filters by `status/service_zone_id/category/search` only — **there is no `collection_method` filter** (`TextileCollectionController::index`, lines 114–146). A drop-off is therefore indistinguishable from a pickup in every queue.

| Desk page (queue)                | Queue `status` filter                 | What a DROP-OFF does here                                                                                   | What a DRIVER TRIP does here                                                                         |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `TextileReviewPage`              | `pending_review`                      | **Appears here** (correct: intake triage). Offers batch **Approve** + row **View**; reject lives in detail. | n/a (a trip doesn't exist yet)                                                                       |
| `TextileSchedulePage`            | `ready_to_group`                      | **Appears here and is schedulable** — grouped by zone, boxed into a batch/trip. ❌ wrong                    | Correct home: group approved stops into a trip, set date/window                                      |
| `TextileDispatchPage`            | `scheduled`                           | **Appears as a "stop"** under a trip with **Record collection / Mark missed**. ❌ wrong                     | Shows trips→stops; per-stop **Record collection** (proof photo + actual bags/kg) and **Mark missed** |
| `TextileCompletedPage`           | `picked_up,missed,rejected,cancelled` | Terminal history (mixed)                                                                                    | Terminal history                                                                                     |
| `TextileStaffDetailPage` (`:id`) | single record                         | Approve/Reject + a **zone** "Drop-off point" editor                                                         | request detail only — **no trip/stop execution screen exists**                                       |

So the answer to "which queue does a drop-off request currently appear in": after approval it flows into the **Schedule (`ready_to_group`) queue and then the Dispatch (`scheduled`) queue**, rendered as if it were a physical field pickup stop.

## DROPOFF-MISROUTING

A `collection_method === 'dropoff'` request is pushed through the pickup pipeline because nothing branches on method:

- `approve` only checks `status === pending_review` (`TextileCollectionOperationsService::approve`); `scheduleBatch` only checks "approved or missed" + same zone (lines ~69–76). Neither blocks drop-offs, so a drop-off becomes `ready_to_group` → `scheduled` → a trip "stop".
- `TextileSchedulePage` lets staff select drop-off requests and fold them into a pickup trip (`scheduleTextileBatch`), which is meaningless for a self-haul.
- On `TextileDispatchPage` the drop-off stop **wrongly offers**: **"Record collection"** (which opens actual bags/weight + a camera **proof photo**) and **"Mark missed"**. `Mark missed` is a driver/field-pickup concept (`missed_pickup_reason`); a drop-off can't be "missed" by a driver.
- The only drop-off-aware UI is `DropoffEditSection` on the detail page, but it edits the **service-zone** drop-off point (`updateTextileZoneDropoff`), not receipting this request.
- `shared.tsx › STATUS_LABELS` has **no drop-off lifecycle states** (nothing like `awaiting_dropoff` / `received_at_centre`), and `fetchTextileQueue` exposes no way to list drop-offs separately.

Net: the desk treats a drop-off as a dispatchable stop and offers field-collection actions instead of a centre receipt.

## MISSING-RECEIPT

An **authorised centre-staff receipt screen** (search by reference/QR → record actual bags + weight → proof photo → exception reason) does **not exist**. Gaps:

- **No screen/queue.** No `TextileStopDetailPage` / receipt page; nothing keyed to drop-off status. `fetchTextileQueue` can't even list drop-offs.
- **No QR.** `TextileCollectionRequest` has a human `reference` but **no QR/token column**; nothing renders or scans a QR. `SearchBox` only does free-text `reference/name/phone` LIKE search (`index` lines 134–137) — no exact-reference or QR lookup, and it's only mounted in the pickup queues, never on a receipt screen.
- **No receipt action / endpoint.** `recordOutcome('collected')` requires status `scheduled` (`assertOutcomeAllowed`) and enforces a proof photo — i.e. it is welded to the _dispatched pickup_ path, not "walk-in received at centre." There is no `received`/`receipt` outcome, no `received_at`/`received_by` columns (model/migration confirm only `picked_up_at`).
- **No exception reason for receipt.** Only `missed_pickup_reason` (field) and `rejection_reason` (pre-approval) exist — no "damaged / over-capacity / wrong material / refused at counter" reason tied to a drop-off receipt.
- **No centre-scoped authorisation.** The policy has a single gate `isCollectionPartner` (any member of any partner department, any zone). There is **no distinct "centre staff" ability and no scoping to the drop-off centre/zone**, so "authorised centre-staff" is not modelled. (`AGENTS.md`: use module-scoped ability names — a new `textile.receive_dropoff` would be required, not a generic `view`.)
- The proof-photo upload mechanism (`uploadTextileProofPhoto`, role `proof`, 10 MB/JPEG-PNG-WebP validation in `TextileDispatchPage`) is reusable, but is currently only wired to the dispatch "Confirm collected" flow.

## MISSING-TRIP

Trip _execution_ is essentially absent — a "trip" is only a scheduling container:

- **No driver/team assignment.** `textile_collection_batches` has **no `driver_id` / `team_id` / assigned_at**; only `created_by`. No API/UI assigns who runs the trip.
- **No vehicle.** No `vehicle_id`/vehicle column or registry link in the batch; `trip_reference` is a free-text string and is **never even sent** — `TextileSchedulePage` calls `scheduleTextileBatch` without `trip_reference` (grep confirms). Docs `08` reference "Vehicle Registry", "Vehicle Number (Future)", "Assignments → Unassigned→Assigned" — designed but unimplemented.
- **No ordered stops.** Requests attach to a `batch_id` with **no sequence/order** field; `TextileDispatchPage` groups by `batch.id` but renders stops in arbitrary return order — no route/stop ordering, no per-stop sequence.
- **No manifest.** No expected-vs-actual manifest view (what should be on board, cumulative weight). Dispatch shows estimated vs a single-stop "actual" entry only.
- **No call / navigate.** Addresses and `contact_phone` are rendered as plain text — **no `tel:` link, no maps/deep-link** (grep: zero `tel:`/maps/navigate across ops textile).
- **No progress / trip lifecycle.** Batch `status` stays `planned`/`scheduled`; there is **no start-trip / complete-trip action, no per-trip progress ("X of N stops done"), and no per-stop detail screen** (`TextileStopDetailPage` missing). `fetchTextileReport` counts trips but nothing tracks a trip in-flight.

## FILE-CHANGES

Per-file changes needed. Marked **[D]** drop-off feature, **[T]** trip feature, **[D+T]** shared concern.

- **`api/textileApi.ts`**
    - **[D]** Add `collection_method?` (and drop-off status values) to `fetchTextileQueue` params; add `receiveTextileDropoff(id, {actual_bags, actual_weight_kg, exception_reason?})` and a `qr`/`reference` lookup fn; extend `recordTextileOutcome` outcome union / add receipt status.
    - **[T]** Add trip-execution calls: `assignTrip(batchId,{driver_id,team_id,vehicle_id})`, `startTrip`/`completeTrip`, `reorderStops(batchId, orderedIds)`, `fetchTripManifest(batchId)`; extend `scheduleTextileBatch` to send driver/vehicle/trip_reference.
- **`shared.tsx`** — **[D+T]** Add drop-off status values to `STATUS_LABELS`/`STATUS_STYLES`; thread `collectionMethod` through `useTextileQueue`/`QueueArgs`; add a `MethodBadge` (Drop-off vs Pickup) used by every queue; if a shared "trip header/progress" component is added it lives here.
- **`TextileReviewPage.tsx`** — **[D]** Show `MethodBadge`; keep Approve for pickups but route drop-off approvals toward an "awaiting drop-off" state rather than `ready_to_group`.
- **`TextileSchedulePage.tsx`** — **[D]** Exclude `dropoff` rows from trip grouping (stop them being boxed into a batch). **[T]** Add driver/team/vehicle pickers + (optional) `trip_reference` to the schedule payload.
- **`TextileDispatchPage.tsx`** — **[D]** Hide drop-off rows from the field-stop board (or move to a receipt sub-tab). **[T]** Add trip manifest header (ordered stops, X/N progress), driver/vehicle line, `tel:`/navigate controls, start/complete trip, and per-stop link to a stop detail screen.
- **`TextileCompletedPage.tsx`** — **[D]** Distinguish "Received at centre" vs "Collected in field" in the history Status column (needs the new drop-off terminal status).
- **`TextileStaffDetailPage.tsx`** — **[D]** Add an **authorised receipt card** (reference/QR lookup target): actual bags + weight + proof photo (reuse dispatch photo logic) + **exception reason**, gated by a new centre-staff ability; keep the zone "Drop-off point" editor separate. **[T]** If used as the stop screen, add call/navigate + stop status.
- **`TextileStopDetailPage.tsx` (NEW)** — **[T]** Create it and register `textile-collections/trips/:batchId/stops/:id` (or reuse `:id`) so the named stop-execution screen actually exists; currently the `:id` route is a request detail, not a stop.
- **`OperationsApp.tsx`** — **[T]** Add route(s) for stop/trip detail; **[D]** optionally a drop-off receipt route.
- **`textileApi`'s sibling backend surface** (outside this folder, listed for completeness): batch/request migrations need driver/team/vehicle + order + receipt columns, controller `index` needs a `collection_method` filter, service needs a `receiveDropoff` path and trip lifecycle, policy needs `textile.receive_dropoff` (centre-scoped) — but per AGENTS.md these are backend, not part of this frontend audit's file set.

## SHARED-FILES (single owner required)

These are touched by **both** features simultaneously and must have one owner to avoid conflicting edits (dirty shared worktree):

1. **`api/textileApi.ts`** — both features add endpoints/types here. **Single owner required.**
2. **`pages/textile/shared.tsx`** — `STATUS_LABELS`/`STATUS_STYLES`, `useTextileQueue`/`QueueArgs`, filters, and any new badge/toolbar are edited by both. **Single owner required** (it's the most-contended file).
3. **`pages/textile/TextileStaffDetailPage.tsx`** — drop-off receipt card **[D]** and stop/trip detail **[T]** both land here unless the new `TextileStopDetailPage` is split out. **Owner must decide the split.**
4. **`OperationsApp.tsx`** (route table) and `textileApi` param surface — both features register routes/params. **Single owner.**

Recommended ownership: one owner for `shared.tsx` + `textileApi.ts` (the queue/API contract layer), drop-off feature owns `TextileStaffDetailPage` + receipt flow, trip feature owns `TextileDispatchPage` + the new `TextileStopDetailPage`. Sequence API/shared changes first so both feature branches build on one contract.

## TEST-GAPS

Existing coverage is thin and biased to the pickup path:

- Only **`TextileDispatchPage.test.tsx`** (2 tests: "no manual refresh", "accessible proof-photo button") and **`shared.test.tsx`** (2 tests on `useTextileQueue` auto-refresh). `shared.test.tsx` mocks `useQuery` wholesale, so `fetchTextileQueue` **param mapping is untested** — a `collection_method` filter addition would pass CI while dropping the wrong rows.
- **No drop-off test at all.** Nothing asserts that a `collection_method: 'dropoff'` row is excluded from Schedule/Dispatch, or that it doesn't render "Mark missed". The dispatch fixture is `collection_method: 'premises'` only.
- **No receipt tests**: QR/reference lookup, actual bags/weight validation, exception-reason requirement, proof-photo-required-before-receipt, and centre-staff authorisation are all untested.
- **No trip-execution tests**: driver/team/vehicle assignment, ordered stops, manifest counts, `tel:`/navigate links, start/complete trip, and per-trip progress — none exist.
- **No test that `scheduleTextileBatch` sends `trip_reference`/driver/vehicle** (it currently sends none).
- **Missing pages need their own specs** when built: `TextileStopDetailPage.test.tsx`, a `TextileSchedulePage.test.tsx` (drop-off exclusion + multi-zone lock), and `TextileCompletedPage.test.tsx` (drop-off "Received" vs field "Collected" distinction). Per AGENTS.md, every bug fix (e.g., "drop-off must not appear on dispatch board") needs a regression test.
