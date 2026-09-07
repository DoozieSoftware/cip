# Textile Collections — Operational Metrics Audit (no new columns)

Scope reviewed: migrations `2026_08_25_000100` (+ `000300`, `000100` optional volumes, `000100` media link, `2026_08_28_000100` partner columns), models `TextileCollectionRequest`, `TextileCollectionBatch`, `TextileServiceZone`, `TextilePartnerCapability`, services `TextileCollectionService` / `TextileCollectionOperationsService`, and the existing partner report endpoint `TextileCollectionController::report()` (`GET /api/v1/.../textile-collections/report`, routes/api.php:391). **There is no `TextileCollectionStatusHistory` model or migration** — only `report_status_history` exists, and it belongs to the Reports module.

---

## TABLES

**`textile_collection_requests`** (core fact table)

- Identity/linking: `id`, `reference`, `citizen_id`, `report_id` (legacy, nullable), `service_zone_id`, `department_id` (partner), `batch_id` (nullable, **nullOnDelete and explicitly set to NULL on missed/rejected/cancelled**)
- Requester: `requester_type` (`individual|rwa`), `requester_name`, `rwa_name`, `contact_email`, `contact_phone`
- Request shape: `category` (`clothes_waste|metal_scrap|e_waste`), `collection_method` (`dropoff|premises`), `estimated_bags` (nullable), `estimated_weight_kg` (nullable — "at least one" enforced at FormRequest level), `latitude/longitude`
- State: `status` ∈ `pending_review, ready_to_group, scheduled, picked_up, rejected, cancelled, missed` — **single-column current-state snapshot, overwritten in place**
- Outcome: `scheduled_date` (DATE only), `scheduled_window_start/end`, `actual_bags`, `actual_weight_kg`, `rejection_reason` (free text), `cancellation_reason` (free text), `missed_pickup_reason` (free text)
- Timestamps: `created_at`, `updated_at`, `submitted_at` (set at creation, backfilled for legacy rows), `picked_up_at` (set only on `collected`)

**`textile_collection_batches`** (trip table): `id`, `reference`, `service_zone_id`, `collection_date` (date), `window_start/end`, `status` (defaults `planned`; **no code path ever updates it — dead column**), `trip_reference`, `created_by`, `created_at` (doubles as schedule-creation time), `instructions`

**`textile_service_zones`**: `code`, `name`, `department_id` (owner partner), `center_lat/lng`, `service_radius_km`, `dropoff_enabled`, `premises_pickup_enabled`, `dropoff_name/address`, `active`

**`textile_partner_capabilities`**: `department_id` + `category` (unique pair) — defines who is a partner and for what

**Adjacent usable tables (already exist, no new columns)**

- `audit_logs` — append-only; `entity='textile_collection'`, actions `textile.approve`, `textile.outcome` with `before`/`after` JSON and `created_at`; `textile.schedule` audits target the **batch** and store only `request_count`, not request IDs
- `media` — `textile_collection_id`, `role='proof'`, `is_replaced` (proof-photo compliance)
- `users`, `departments` — requester/partner dimensions

Key structural facts driving the verdicts below: statuses are overwritten (no history), terminal transitions null `batch_id` (trip attribution lost for missed/cancelled), and only two event timestamps exist (`submitted_at`, `picked_up_at`).

---

## COMPUTABLE (yes, today)

| Metric                                                | Source columns / joins                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requests received**                                 | `COUNT(*)` on `textile_collection_requests` over `submitted_at` (or `created_at`); grain by day/zone/category/department                                                                                                                                                                                                      |
| **Collected count / volume**                          | `status='picked_up'` or `picked_up_at IS NOT NULL`; sums of `actual_bags`, `actual_weight_kg`                                                                                                                                                                                                                                 |
| **Estimate-vs-actual totals**                         | `SUM(actual_bags) vs SUM(estimated_bags)`, `SUM(actual_weight_kg) vs SUM(estimated_weight_kg)` — already emitted by `report()` as `total_volume_kg` vs `estimated_volume_kg`                                                                                                                                                  |
| **Drop-off vs pickup mix**                            | `GROUP BY collection_method` (`dropoff                                                                                                                                                                                                                                                                                        | premises`) |
| **Current missed backlog**                            | `status='missed'` count + `missed_pickup_reason` text                                                                                                                                                                                                                                                                         |
| **Current cancelled count**                           | `status='cancelled'` + `cancellation_reason` text                                                                                                                                                                                                                                                                             |
| **Current rejected count**                            | `status='rejected'` + `rejection_reason` text                                                                                                                                                                                                                                                                                 |
| **Booking → collection time / end-to-end turnaround** | `picked_up_at − submitted_at` (both timestamps on the same row)                                                                                                                                                                                                                                                               |
| **Per-zone breakdown**                                | `service_zone_id → textile_service_zones.id` (`name`, `code`, `department_id`)                                                                                                                                                                                                                                                |
| **Per-category breakdown**                            | `GROUP BY category`                                                                                                                                                                                                                                                                                                           |
| **Per-partner breakdown**                             | `department_id → departments` (partner set validated via `textile_partner_capabilities`)                                                                                                                                                                                                                                      |
| **Per-trip breakdown (attributed only)**              | `batch_id → textile_collection_batches` (`reference`, `trip_reference`, `collection_date`)                                                                                                                                                                                                                                    |
| **Trip count**                                        | `COUNT(textile_collection_batches)` by `collection_date`/`service_zone_id`                                                                                                                                                                                                                                                    |
| **Requests per trip**                                 | `GROUP BY batch_id` on requests                                                                                                                                                                                                                                                                                               |
| **Unique requesters served**                          | `COUNT(DISTINCT contact_email)` (or `citizen_id`, `contact_phone`)                                                                                                                                                                                                                                                            |
| **Individual vs RWA mix**                             | `GROUP BY requester_type`, `rwa_name`                                                                                                                                                                                                                                                                                         |
| **Zone coverage/config metrics**                      | flags `dropoff_enabled`, `premises_pickup_enabled`, `active`, `service_radius_km` on zones                                                                                                                                                                                                                                    |
| **Partner capacity config**                           | counts per category from `textile_partner_capabilities`                                                                                                                                                                                                                                                                       |
| **Proof-photo compliance**                            | `media WHERE textile_collection_id = requests.id AND role='proof' AND is_replaced=false`                                                                                                                                                                                                                                      |
| **Booking → approval time (approximate/retro)**       | ⚠️ Yes **only via `audit_logs`**: `entity='textile_collection' AND action='textile.approve'` → `audit_logs.created_at − requests.submitted_at` joined on `entity_id = requests.id`. Works and is trustworthy (append-only), but is a JSON blob join with no index on `entity_id` — fine for periodic reports, not dashboards. |

---

## NOT-COMPUTABLE (no)

| Metric                                                              | Why not                                                                                                                                                                                                                                                                             | Closest workaround today                                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **True approval rate**                                              | `status` is overwritten. A request approved then later cancelled/missed/re-scheduled shows only the final state; cumulative "ever approved" is invisible on the row                                                                                                                 | `audit_logs` action `textile.approve` (per request, reliable); `report()`'s `status_breakdown` is snapshot-only |
| **Cumulative no-show / missed rate**                                | `recordOutcome('missed')` sets `batch_id = NULL` and status `missed`; a missed request can be re-scheduled (per `scheduleBatch`), and after pickup leaves **zero trace** of prior misses. Denominator "per scheduled trip" is unrecoverable because trip→miss attribution is erased | Count of requests _currently_ in `missed` only                                                                  |
| **Missed attributed to a specific trip**                            | Same `batch_id` nulling; `textile.schedule` audit row is keyed to the batch and stores only `request_count`, **not request IDs**                                                                                                                                                    | None                                                                                                            |
| **Rejection / cancellation / missed reason MIX (as categories)**    | `rejection_reason`, `cancellation_reason`, `missed_pickup_reason` are free-text `TEXT`; a "mix" would be unbounded raw strings                                                                                                                                                      | Lexical clustering in the consumer (unreliable)                                                                 |
| **Cancellation rate by canceller (citizen vs staff)**               | No `cancelled_by` / actor column                                                                                                                                                                                                                                                    | `audit_logs` `textile.outcome` `user_id` vs `requests.citizen_id` (retro-hack)                                  |
| **Schedule → pickup (dispatch turnaround, exact)**                  | `scheduled_date` is DATE only; the actual moment of scheduling exists only on `batches.created_at`, which is lost for missed/cancelled rows                                                                                                                                         | `batches.created_at → picked_up_at` for still-attributed rows only (approximate)                                |
| **Estimated vs actual delta per request (reliably)**                | Both estimate columns became nullable (`2026_08_26_000100`, "bags OR kg" rule) and actuals are recorded in whichever unit staff entered; many rows will have estimate in bags but actual in kg, or one leg null → heavy silent survivorship in any delta metric                     | Compute per-unit deltas only where both legs non-null and report coverage %                                     |
| **Trip completion rate / trip status metrics**                      | `batches.status` is never transitioned past `'planned'` anywhere in `TextileCollectionOperationsService` — dead field                                                                                                                                                               | Infer per-trip from member request statuses (corrupted by `batch_id` nulling)                                   |
| **Multi-touch lifecycle (Nth reschedule, avg touches per request)** | No history table                                                                                                                                                                                                                                                                    | None                                                                                                            |
| **Booking → first-response time**                                   | First response could be approve/reject/cancel; only `picked_up_at` exists, and rejection/approval timestamps live only in audit logs                                                                                                                                                | `LEAST(audit approve/reject created_at) − submitted_at`                                                         |

---

## NEW-FIELDS-NEEDED

Minimal set (per-metric patches):

1. `textile_collection_requests.approved_at` (timestamp, nullable) — approval rate + booking→approval without audit-log joins
2. `textile_collection_requests.scheduled_at` (timestamp, nullable) — set alongside `scheduled_date` in `scheduleBatch()`; exact dispatch turnaround
3. `textile_collection_requests.cancelled_at`, `missed_at`, `rejected_at` (timestamps) — funnel timing per stage
4. `cancelled_by_type` / `closed_by` (uuid, nullable) — citizen vs staff cancellation
5. `rejection_reason_code`, `cancellation_reason_code`, `missed_reason_code` (short string enum) — keep free text, add normalized code for reason-mix charts
6. `trip_id` retained: either stop nulling `batch_id` on terminal outcomes, or add a `textile_collection_request_trips` pivot (`collection_request_id`, `batch_id`, `outcome`, `occurred_at`) — restores per-trip no-show attribution and multi-trip history
7. `batches.completed_at` + real `status` lifecycle (`planned → dispatched → completed`) — trip-level SLAs

Preferred structural fix (one migration, replaces 1–4 and 6): a **`textile_collection_status_history`** table mirroring the existing `report_status_history` pattern (`id`, `collection_request_id`, `from_status`, `to_status`, `reason`, `actor_id`, `created_at`) written by `TextileCollectionOperationsService` (or a listener, since lifecycle events like `TextileCollectionScheduled/Collected/Rejected` already exist). Every "NOT-COMPUTABLE" timing/history metric becomes computable from it; reason-code columns (5) are still recommended separately.

---

## METRIC-DEFINITIONS

- **Requests received** = `COUNT(*) WHERE submitted_at BETWEEN t0 AND t1`. Use `submitted_at` (set in `TextileCollectionService::create`, backfilled for pre-decoupling rows); `created_at` is an acceptable proxy.
- **Approval rate** = requests with a `textile.approve` audit event ÷ requests received in cohort. _Today's snapshot proxy:_ `(ready_to_group + scheduled + picked_up + missed) ÷ all`.
- **Rejection/cancellation/missed rate** = `status IN (...)` ÷ received in cohort — **snapshot-biased**: understates cumulative counts because statuses are overwritten downstream; label as "currently rejected/cancelled/missed".
- **Collected count** = `COUNT(*) WHERE picked_up_at IS NOT NULL`. Collection rate = ÷ requests received (cohort) — a clean funnel numerator because `picked_up` is a terminal state that is never overwritten.
- **Estimate-vs-actual delta** = `Σ(actual_weight_kg) − Σ(estimated_weight_kg)` restricted to rows where **both** legs are non-null; always publish `coverage = rows_with_both ÷ collected` alongside, since estimates are optional bags-or-kg.
- **Booking→approval time** = `audit_logs(textile.approve).created_at − submitted_at` (today); `approved_at − submitted_at` after new column.
- **Booking→collection time** = `picked_up_at − submitted_at`, both on the request row. Exact today.
- **Dispatch turnaround** = `picked_up_at − scheduled_at`; today approximated as `picked_up_at − batches.created_at` for rows whose `batch_id` survived.
- **No-show (missed) rate** = missed events ÷ scheduled-attempts. Not definable exactly today; after the status-history/pivot table: `COUNT(to_status='missed') ÷ COUNT(to_status='scheduled')` in period.
- **Drop-off vs pickup mix** = `GROUP BY collection_method` over requests received.
- **Per zone / category / partner** = join `service_zone_id → textile_service_zones`, `GROUP BY category`, join `department_id → departments` (the existing `report()` endpoint uses zone-owner partner resolution via `assertCollectionPartner`).
- **Per trip** = `GROUP BY batch_id` (requests with surviving attribution); true per-trip outcomes require the request↔trip pivot from NEW-FIELDS-NEEDED #6.
- **Trips run** = distinct batches with `collection_date` in period; **trips per partner** via `batches.service_zone_id → zones.department_id`.

**Bottom line:** ~14 of 18 candidate metrics are computable today from the request/batch/zone/capability tables alone; booking→collection turnaround, drop-off/pickup and zone/category/partner breakdowns are fully exact; approval rate and reason mixes are computable but snapshot-biased or unnormalized; cumulative missed-rate, per-trip no-show attribution, and trip lifecycle are the real gaps — all closed by one `textile_collection_status_history` table plus three reason-code columns.
