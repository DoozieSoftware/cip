# Textile Collection — Phase 0 Decision Register

> **Branch:** `codex/textile-phase-0`
>
> **Status:** In discovery — no lifecycle, schema, or API changes are approved by this document.
>
> **Purpose:** Capture the manager and partner decisions required before implementing the next operational phases in `textile-collection-next-phases.md`.

## How to use this register

- **Owner** provides the business answer.
- **Recommendation** is an engineering/product recommendation, not a final decision.
- **Decision required** items block the phase named in their row.
- Once approved, copy the decision into the implementation specification and derive the exact data model, API contract, authorization, migration, and test cases. Do not invent those implementation details beforehand.

## Current-state evidence

- A citizen request accepts `collection_method` values `dropoff` and `premises`.
    - Source: `backend/app/Modules/TextileCollections/Http/Requests/StoreTextileCollectionRequest.php`
- Approval currently moves every pending request to `ready_to_group`; batch scheduling accepts approved/missed requests from one zone without checking collection method.
    - Source: `backend/app/Modules/TextileCollections/Services/TextileCollectionOperationsService.php`
- A service zone holds drop-off enabled/name/address and premises-pickup enabled, but not operating hours, public contact details, or material-specific centre instructions.
    - Source: `backend/app/Modules/TextileCollections/Models/TextileServiceZone.php`
- A batch holds a zone, date/window, reference, and instructions; it has no driver/team, vehicle, or stop-order model.
    - Source: `backend/app/Modules/TextileCollections/Models/TextileCollectionBatch.php`
- Current scheduled notification is an SMS after batch scheduling. It sends the date/window/reference/partner, not an arrival ETA or drop-off receipt.
    - Source: `backend/app/Modules/TextileCollections/Listeners/SendTextileScheduledNotification.php`

## D-01 — Define the drop-off service

**Status:** Open  
**Owner:** Manager + partner operations lead  
**Blocks:** Phase 1

### Decision required

Is drop-off:

1. a reservation where the citizen must first receive approval and a reference/QR;
2. a walk-in service where booking is optional; or
3. both, with different treatment for each partner/zone?

### Recommendation

Start with **approved reservation drop-off** for the pilot:

```text
Citizen books drop-off → partner approves → citizen receives centre details/reference
→ authorised centre staff records receipt → citizen receives confirmation
```

This creates a reliable audit trail, lets capacity be managed, and does not force the request into a driver trip.

### Required acceptance examples

- An approved drop-off request cannot appear in trip scheduling or driver dispatch.
- A citizen sees a clear next step instead of “Pickup date: not scheduled yet”.
- A walk-in item cannot be silently attached to another citizen’s booking.

## D-02 — Define centre receipt and proof requirements

**Status:** Open  
**Owner:** Partner operations lead + security owner  
**Blocks:** Phase 1

### Decision required

- Who may record receipt: centre counter staff, collection crew, or both?
- Is a booking reference enough, or is QR/barcode scanning required?
- Which proof is mandatory: actual bags, actual weight, one photo, recipient identity, signature, timestamp, location, or a defined subset?
- What exception is used when the material/quantity does not match the booking?

### Recommendation

For the first release, require an authorised staff member, booking reference or QR, actual bags/weight, and one proof photo. Keep staff identity, server timestamp, and audit event server-generated. Treat signature and precise staff location as later decisions because they introduce privacy and device-support requirements.

### Required acceptance examples

- A receipt cannot be recorded without the approved proof requirements.
- A staff member cannot receive a booking from another partner/zone.
- Repeating a scan/submit cannot create two receipts.

## D-03 — Define centre information shown to citizens

**Status:** Open  
**Owner:** Partner operations lead  
**Blocks:** Phase 1 citizen experience

### Decision required

For each active drop-off centre, confirm:

- public name and exact address;
- operating days/hours and holiday exceptions;
- public contact method;
- accepted categories/material condition rules;
- check-in instructions and accessibility constraints;
- whether the centre is temporarily full/closed and who changes that status.

### Recommendation

Make this partner-owned zone configuration with validation, authorization, and audit logging. The current name/address/map support is a base, but it is insufficient for a citizen to complete a drop-off confidently.

### Required acceptance examples

- A citizen cannot be directed to a centre outside its published hours without an explicit exception.
- Staff can update a temporary closure without a deploy.
- Updating one partner’s centre cannot change another partner’s centre.

## D-04 — Define pickup-trip responsibility

**Status:** Open  
**Owner:** Partner operations lead  
**Blocks:** Phase 2

### Decision required

- Is a trip assigned to an individual driver, a named crew/team, or an unassigned operations pool?
- Is vehicle assignment mandatory, optional, or not tracked?
- Who creates, changes, and overrides assignment/order?
- Is stop ordering manual, partner-defined, or route-suggested?
- What information may the field worker see and use to contact a citizen?

### Recommendation

Start with a named team/driver assignment and manual stop order. Add route suggestions only after the partner confirms routing rules and capacity constraints. Expose a controlled call action, not private staff contact information.

### Required acceptance examples

- A field worker sees only trips they are authorized to operate.
- An assignment/order change is audit-logged.
- A collection result submitted by one worker cannot overwrite a newer result from another worker.

## D-05 — Define rescheduling and cancellation policy

**Status:** Open  
**Owner:** Manager + partner operations lead  
**Blocks:** Phase 3

### Decision required

- Until what point may a citizen reschedule or cancel without partner approval?
- May staff reschedule after a trip is created? Who may do so?
- Does rescheduling keep the same booking reference and evidence, or create a successor record?
- What happens to a missed pickup: automatic re-booking offer, staff review, or citizen starts again?

### Recommendation

Allow citizen self-service rescheduling only before the partner-approved operational cutoff and before field execution starts. Keep the same booking/evidence history, record the old and new schedule in audit history, and require staff override after the cutoff.

### Required acceptance examples

- Rescheduling cannot leave the request in two active trips.
- Cancelled/rejected/completed requests cannot receive a reminder.
- Citizen and partner see an understandable reason when a slot cannot be selected.

## D-06 — Define notification channels and timing

**Status:** Open  
**Owner:** Manager + notifications owner  
**Blocks:** Phases 1 and 3

### Decision required

- Which channels are approved for acknowledgement, scheduled pickup, reminder, on-the-way update, receipt, and exception messages?
- Which channel is mandatory versus fallback?
- What notification preferences and consent rules apply?
- Who controls partner-specific message wording?

### Recommendation

Use the existing notification-template/dispatcher framework. Add only approved lifecycle messages, respect consent/preferences and rate limits, and make delivery failures observable without blocking collection operations.

### Required acceptance examples

- A drop-off receipt is sent only after a successful receipt transition.
- A pickup reminder is suppressed after cancellation/rejection/completion.
- A delivery failure is logged and does not reverse the collection outcome.

## D-07 — Define quantity and capacity policy

**Status:** Open  
**Owner:** Partner operations lead + finance/operations manager  
**Blocks:** Phase 5; informs Phase 1/2 UX

### Decision required

- Are stated minimum quantities hard rejection rules, review flags, or a suggestion to use drop-off?
- Which capacity dimensions apply: bags, kilograms, vehicle, crew, time window, category compatibility, or zone/day?
- Who may override a capacity/minimum rule and what reason is required?

### Recommendation

Treat minimum quantities as partner-configured review guidance for the pilot, not an automatic citizen rejection. Display a drop-off recommendation when appropriate. Add capacity warnings before automated planning; require an authorised, audited human override.

### Required acceptance examples

- A partner can change a threshold without code deployment.
- A low-quantity request has an understandable citizen path.
- Capacity overrides retain actor, reason, and policy context.

## D-08 — Define offline and location policy

**Status:** Open  
**Owner:** Security owner + partner operations lead  
**Blocks:** Phase 4

### Decision required

- Is offline proof capture required for the pilot, and on which devices/browsers?
- May proof media/quantities be held locally until upload succeeds?
- Is approximate or precise location needed for collection proof, or is it not collected?
- What should happen on logout, expired session, device loss, upload failure, or conflicting retry?

### Recommendation

Do a security and device-support spike before implementing offline storage. Preserve server-side authorization, proof validation, checksum, audit, and idempotency requirements; offline mode must never bypass them.

### Required acceptance examples

- A pending offline upload is visible to the worker and cannot silently disappear.
- Retry creates one final collection outcome.
- Logout/session expiry follows the approved safe-handling policy.

## Phase 0 workshop outputs

Phase 0 is complete only when the following are approved:

1. A separate pickup and drop-off lifecycle diagram.
2. A role/permission matrix for citizen, partner reviewer, scheduler, driver/team, centre staff, and administrator.
3. A decision for each D-01 through D-08 item above.
4. A notification matrix covering trigger, audience, approved channel, template owner, and suppression rules.
5. A migration/data-retention approach reviewed by engineering and security.
6. An acceptance-test matrix for normal, exception, authorization, concurrency, and evidence cases.

## Immediate manager questions

1. Do we launch drop-off as approved reservation, walk-in, or both?
2. What exactly does the centre staff need to record to confirm receipt?
3. Who owns a pickup trip: driver, team, or operations pool?
4. What rescheduling cutoff is acceptable to the partner?
5. Which notification channels are approved for this service?
