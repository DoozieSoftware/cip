# Textile Collection Service — Next-Phase Implementation Plan

> **Status:** Phase 0 and Phase 1 design + code — see §0.
>
> **Purpose:** Extend the deployed multi-partner collection service from booking and basic dispatch into a complete, operationally sound service.
>
> **Scope:** Citizen collection booking, partner review/scheduling/dispatch, proof media, notifications, and operational reporting. Complaint reporting remains separate.

## 0. Progress as of 2026-08-27 — what is now complete

**Branch:** `codex/textile-phase-0` @ `a3950bdd`.

| Phase          | What                                                    | Where                                                            | Status |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| Phase 0        | Decision register (D-01..D-08)                          | `plans/textile-phase-0-decision-register.md`                     | ✅     |
| Phase 0        | Flow audit (status machine, guards, routes, migrations) | `plans/phase0/flow-audit.md` (16K)                               | ✅     |
| Phase 0        | Citizen journey audit                                   | `plans/phase0/citizen-journey-audit.md` (11K)                    | ✅     |
| Phase 0        | Ops queue audit                                         | `plans/phase0/ops-queue-audit.md` (13K)                          | ✅     |
| Phase 0        | Metrics audit                                           | `plans/phase0/metrics-audit.md` (13K)                            | ✅     |
| Phase 0        | Security/media/notification/concurrency audit           | `plans/phase0/security-audit.md` (12K)                           | ✅     |
| Phase 1 design | Backend spec (statuses, schema, API, authZ, audit)      | `plans/phase1/01-backend-spec.md` (20K)                          | ✅     |
| Phase 1 design | Citizen UX spec                                         | `plans/phase1/02-citizen-ux.md` (16K)                            | ✅     |
| Phase 1 design | Ops UX spec (receipt + trip manifest)                   | `plans/phase1/03-ops-ux.md` (15K)                                | ✅     |
| Phase 1 design | QA matrix                                               | `plans/phase1/04-qa-matrix.md` (11K)                             | ✅     |
| Phase 1 code   | Backend (migrations, models, services)                  | `codex/textile-phase1-backend` @ `1d8e3573` — 25 files +798/-26  | ✅     |
| Phase 1 code   | Citizen UI (CentreCard, Progress, Receipt)              | `codex/textile-phase1-citizen` @ `a126fadc` — 15 files +699/-267 | ✅     |
| Phase 1 code   | Ops UI (ReceiptPage, Schedule, Dispatch)                | `codex/textile-phase1-ops` @ `6d5ae96a` — 12 files +779/-261     | ✅     |
| Phase 1 code   | Tests (Pest + Vitest + Playwright, many `todo` for D-*) | `codex/textile-phase1-qa` @ `28a1c510` — 8 files +551            | ✅     |

## 1. Current baseline

The current service already supports:

- Citizen booking for clothes, metal scrap, and e-waste collection.
- A `pickup` / `drop-off` choice, zone selection, quantity estimates, citizen evidence photo, and cancellation.
- Partner review, zone-based batch scheduling, dispatch proof photo, actual bags/weight, missed-pickup recording, and history.
- Partner/category capability routing, signed media URLs, audit logging, and scheduled/collected/rejected notifications.

### Important flow gap

`dropoff` and `premises` requests currently share the same workflow:

```text
pending review → ready to group → scheduled batch → dispatch → collected
```

That is correct for a doorstep pickup, but wrong for a citizen who takes bags to a drop-off centre. The first next phase must correct this before adding more operational features.

### Important trip-execution gap

A scheduled batch currently contains a zone, date/window, reference, and instructions. It does **not** yet model an assigned driver/team, vehicle, ordered stops, or field navigation/calling workflow.

## 2. Product principles

1. **Pickup and drop-off are different services.** Do not force a drop-off through a driver-trip workflow.
2. **The citizen must always know what happens next.** Show status, time/window, location, instructions, and contact/notification expectations clearly.
3. **Staff actions must be fast at the point of work.** A field worker should complete a stop with as few safe steps as possible.
4. **No automatic operational decision without a human owner.** The system may suggest capacity/route groupings, but a partner approves scheduling and exceptions.
5. **Evidence remains auditable.** Proof media, actual quantities, staff actions, and exceptions require authorization and audit logging.
6. **Configuration beats partner-specific code.** New partners, zones, capabilities, capacity, and instructions must not require a new code path.

## 3. Phase 0 — Operational decisions and design contract

**Goal:** Obtain the business rules required to implement the later phases without inventing workflow states, data fields, or policy.

### Decisions required from manager/partner

- Is a drop-off reservation required, or may a citizen walk in without booking?
- What information must a drop-off acknowledgement contain: reference, QR/barcode, centre hours, contact number, accepted materials, or all of these?
- What is the receipt rule: counter staff only, driver/crew only, or both?
- What are the rescheduling cutoff rules and who may override them?
- Which staff role may assign a driver/team and vehicle?
- Is stop ordering manual, partner-defined, or route-suggested?
- What quantities make a request eligible for a pickup versus a drop-off recommendation?
- What data may be captured by field staff: photo only, timestamp, coarse location, exact location, signature, or none beyond photo?
- Which reminder channels are approved: push, SMS, WhatsApp, email?
- What capacity dimensions matter: bags, kilograms, vehicle, crew, time window, or zone/day?

### Technical design work

- Document the proposed lifecycle separately for `premises` and `dropoff` requests.
- Decide the minimal additional states and transitions; do not overload `scheduled` or `picked_up` for centre receipt.
- Define authorization, audit-event, retention, and notification requirements for each new action.
- Define migration/backfill rules for existing requests and batches.
- Define availability, offline, and failure behaviour for field proof capture.

### Exit criteria

- Manager and partner approve the lifecycle diagrams and operating rules.
- Product, operations, security, and engineering agree the data/API contract.
- Acceptance scenarios cover normal flow, cancellation, rejected request, no-show, failed upload, duplicate receipt, and staff permission failure.

## 4. Phase 1 — Dedicated drop-off lifecycle

**Goal:** Make drop-off a centre-receipt service instead of a driver-trip stop.

### Citizen experience

1. Citizen chooses **Drop-off** while booking.
2. After approval, the request shows:
    - exact centre name and address;
    - operating hours and accepted-material instructions;
    - a booking reference and, if approved in Phase 0, QR/barcode;
    - an Open in Maps action;
    - a clear “take bags to this centre” next step.
3. Citizen receives an acknowledgement and receipt notification when staff records the bags.

### Partner experience

- Review drop-off requests separately from doorstep pickup requests.
- Do not offer trip scheduling for approved drop-off requests.
- Give authorised centre staff a lightweight receipt screen to find a booking by reference/QR and record:
    - received quantity and weight;
    - required proof photo;
    - any exception reason.
- Maintain an auditable receipt history visible to the citizen and partner.

### Backend and data work

- Add only the workflow/state/data concepts approved in Phase 0 through new migrations.
- Keep drop-off receipt authorization separate from driver dispatch authorization.
- Add dedicated lifecycle events/listeners for approval, receipt, rejection, and cancellation as required.
- Reuse the existing media storage, checksum, signed-URL, and audit infrastructure; do not duplicate evidence storage.
- Ensure current scheduled pickup batches continue to work unchanged.

### Acceptance criteria

- A drop-off request cannot be added to a driver batch.
- A driver pickup cannot be completed from the drop-off counter flow.
- A receipt requires the configured proof/quantity requirements.
- Citizens can see an understandable next step at every status.
- All receipt, rejection, and cancellation actions are permission-checked and audit-logged.

## 5. Phase 2 — Driver/team trip execution

**Goal:** Turn a scheduled pickup batch into an executable field-work plan.

### Partner experience

- Assign an approved driver/team and, if required by the partner, vehicle to a trip.
- Maintain an ordered stop list within the trip.
- Provide a mobile-first manifest with:
    - next stop and customer address;
    - Open in Maps;
    - call customer action;
    - estimated and actual quantity;
    - collection instructions and citizen evidence photo;
    - record collected / mark missed actions.
- Show trip progress: unstarted, in progress, completed, and exceptions requiring follow-up.

### Citizen experience

- Show a confirmed pickup date/window and collection status.
- Show an appropriate service-contact route without revealing staff private contact data.

### Backend and data work

- Introduce only Phase-0-approved assignment, vehicle, stop-order, and trip-progress concepts.
- Keep the existing batch as the authoritative trip aggregate where possible.
- Enforce partner/zone ownership and staff assignment authorization.
- Audit assignment changes, reordering, outcomes, and exception overrides.
- Keep the collection outcome as the only transition that finalizes a successful doorstep pickup.

### Acceptance criteria

- An assigned worker sees only trips they are authorized to operate.
- The manifest works on narrow mobile screens.
- Recording a stop cannot overwrite another staff member’s later outcome.
- A missed stop leaves a clear re-scheduling path and citizen-visible explanation.
- Every map/call action uses approved external-link or connector rules.

## 6. Phase 3 — Citizen self-service and proactive communication

**Goal:** Reduce no-shows and support changes without support-team intervention.

### Features

- Reschedule an eligible doorstep pickup before the Phase-0-approved cutoff.
- Show unavailable dates/windows instead of accepting a request that cannot be served.
- Send approved-channel reminders before the trip date.
- Send a partner-controlled “on the way” or arrival-window update when trip execution begins.
- Let citizens update permitted readiness/contact instructions without changing protected historical evidence.
- Provide a clear fallback when a requested slot is no longer available.

### Guardrails

- Rescheduling must remove/reconcile the old trip assignment atomically.
- Do not expose a staff member’s personal phone number.
- Respect notification preferences, consent, rate limits, and delivery failure handling.
- Freeze rescheduling when field execution has started, except for an authorised partner override.

### Acceptance criteria

- A citizen cannot create duplicate active bookings by repeatedly rescheduling.
- The old and new schedule are visible in the audit/history record.
- A reminder is never sent for a cancelled, rejected, or already-completed request.
- Partner staff can see why an item became unavailable or was rescheduled.

## 7. Phase 4 — Offline-safe field collection

**Goal:** Allow staff to complete a legitimate stop when connectivity is poor without losing proof or creating duplicate outcomes.

### Features

- Queue a collection outcome, proof photo, and actual quantities locally when the network is unavailable.
- Display a clear pending-upload state to the worker.
- Retry safely when connectivity returns.
- Provide an authorised recovery view for uploads that permanently fail.

### Security and reliability requirements

- Perform a security review before device-local storage is introduced.
- Keep queued evidence tied to the authenticated user/session and clear it after confirmed upload according to the approved retention policy.
- Preserve existing server-side validation, media checksum, authorization, and audit requirements; offline mode must not bypass them.
- Use idempotency/concurrency controls so retry cannot produce two collection outcomes.

### Acceptance criteria

- A worker can capture a proof photo without network and see an explicit pending state.
- Retry produces one final outcome and one authoritative proof chain.
- Logout, expired session, device change, and corrupted upload have defined safe behaviour.
- No proof is silently discarded.

## 8. Phase 5 — Capacity, planning, and exception controls

**Goal:** Help partners operate profitable, realistic routes while keeping humans responsible for decisions.

### Features

- Partner-configured minimum quantities and pickup eligibility guidance, replacing frontend-only threshold literals.
- Per-zone/day capacity rules based on the Phase-0-approved measures (for example, quantity, weight, vehicle, team, or time).
- Scheduling warnings when a selected trip exceeds capacity or mixes incompatible material/vehicle requirements.
- Suggested zone grouping and stop ordering; staff confirms before scheduling.
- A clear exception workflow for high-value, urgent, or manually approved below-minimum requests.

### Guardrails

- Do not silently reject a citizen request purely because a recommendation is below target; apply the approved business policy.
- Make all capacity settings partner-owned, validated, auditable, and configurable.
- Do not hardcode a Dr. Linen-only rule into the shared multi-partner engine.

### Acceptance criteria

- Capacity warnings are explainable to staff.
- Staff may override only with the approved role/reason/audit trail.
- A partner can change its policy without a code deploy.
- Existing requests retain the decision context that applied when they were reviewed.

## 9. Phase 6 — Partner reporting and continuous improvement

**Goal:** Give partners and CIP enough visibility to improve service quality and economics.

### Reporting dimensions

- Requests received, approved, rejected, cancelled, scheduled, collected, and missed.
- Estimated versus actual bags and kilograms.
- Time from booking to approval, schedule, and collection.
- Missed-pickup, reschedule, and exception rates.
- Performance by partner, category, zone, trip, and collection method.
- Drop-off centre receipt volume and doorstep-pickup volume reported separately.

### Delivery approach

- Start with a partner-facing operational dashboard and exportable report consistent with existing department reporting conventions.
- Add data-quality checks before treating any metric as a performance KPI.
- Set targets only after a baseline period; do not invent targets before operational data exists.

### Acceptance criteria

- Every metric has a documented definition and source.
- Staff cannot see another partner’s data without authorization.
- Dashboard totals reconcile with the underlying collection records and proof/audit trail.

## 10. Cross-phase engineering and release requirements

### Architecture

- Keep controllers thin; use Form Requests, policies, services, repositories/resources, queued jobs, and lifecycle events.
- Add new migrations only; never edit existing migrations.
- Use UUIDs, strict typing, DTOs across domain boundaries, and global-unique Gate ability names.
- Store only media metadata in the database; evidence bytes remain on the configured storage disk and are served by signed URL.

### Security and privacy

- Apply least privilege to citizen, partner desk, driver/team, centre-receipt, and administrator actions.
- Audit lifecycle transitions, assignment changes, capacity overrides, proof uploads, and external notifications.
- Validate all client input and re-authorize server-side.
- Assess location, contact, and offline-device data before collection; capture only what the approved process requires.

### Testing and rollout

- Add backend feature tests for every new transition, authorization rule, notification, idempotency/concurrency case, and media requirement.
- Add frontend unit tests for user-facing states and end-to-end tests for the critical citizen and staff journeys.
- Roll out each phase behind an approved partner/zone configuration or feature flag where feasible.
- Pilot with one partner/zone, review operational evidence, then expand deliberately.
- Maintain rollback instructions that preserve existing collection records and media.

## 11. Recommended delivery order

1. **Phase 0:** approve the operating policy and data contract.
2. **Phase 1:** dedicated drop-off lifecycle.
3. **Phase 2:** driver/team trip execution.
4. **Phase 3:** citizen self-service and reminders.
5. **Phase 4:** offline-safe field collection.
6. **Phase 5:** capacity and planning controls.
7. **Phase 6:** reporting and continuous improvement.

## 12. Immediate next action

Run a manager/partner decision session for Phase 0, starting with these three questions:

1. Should a drop-off booking require a reservation and QR/reference, or be walk-in?
2. Who records receipt at a drop-off centre, and what proof is mandatory?
3. Who is assigned to a pickup trip, and what must a field worker see/do at each stop?

No Phase 1 schema, endpoint, or state implementation should begin until those answers are approved.
