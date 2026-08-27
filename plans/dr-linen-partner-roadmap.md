# Dr. Linen → Multi-Partner Collection Platform: Master Plan

> Status: Phases 1, 1b, 2 and 3 — IMPLEMENTED & VERIFIED (2026-08-26)
> Created: 2026-08-26
> Context: The Dr. Linen textile collection module (see `~/Documents/Dr. Linen x CIP.pdf`)
> is complete and tested end-to-end. This plan covers what comes next: photo evidence,
> onboarding a second partner (metal/e-waste client), and cross-partner pickup.

## Background decisions (already made)

1. **Textile collection is a standalone module, not a complaint category.**
   Complaints (report a problem → AI → moderator → department resolves) and
   partner pickups (book a service → acknowledge → group by zone → schedule →
   collect → log volume) are different jobs. The SRS describes the pickup flow;
   forcing it through the complaint pipeline failed in live testing (stuck at
   AI/moderator steps that serve no purpose for a pickup).

2. **Metal scrap / e-waste is a second private partner client** (unrelated to
   Dr. Linen) — not a BBMP function. Same architectural shape as Dr. Linen:
   pickup-as-a-service. It should leave the complaint form when its module ships.

3. **Partners may cross over materials** (Dr. Linen picks up e-waste; the other
   partner picks up clothes). The design must support this via configuration.

---

## Phase 1 — Photo evidence (DONE — implemented + live-verified)

**Goal:** trust building — citizen's "before" photo, crew's "after" proof,
shown side by side. Mirrors the existing complaint evidence/proof pattern.

| Piece | Detail | Required? |
|---|---|---|
| Citizen photo | 1 photo on the request form ("show us the bags") | Optional |
| Crew proof photo | Uploaded on the dispatch board when recording "Collected" | **Required** — enforced by API (422 without it) |
| Trust view | Citizen pickup detail page shows before/after side by side | — |

**Technical design (partner-agnostic on purpose):**

- `media` table gains a **nullable `textile_collection_id`** column (+ FK, index).
  Photos link to the *collection request*, never to "Dr. Linen" specifically —
  so Phase 2 generalization carries photos over with zero migration.
- `report_id` on `media` becomes nullable (it is currently NOT NULL) so the same
  table serves both flows.
- Reuse `MediaService::uploadPhoto` pipeline (storage disk, checksum sha256,
  audit log) and `MediaUrl` signed-URL delivery — identical to complaint evidence.
- New endpoints:
  - `POST /api/v1/citizen/textile-collections/{collection}/photo` — owner only,
    image mime, max ~10 MB, role `evidence`, replaces previous citizen photo
    (version/is_replaced chain-of-custody, same as complaints).
  - `POST /api/v1/department/textile-collections/{collection}/proof` —
    `textile.record_outcome` gate, role `proof`.
- `TextileCollectionRecordOutcome` validation: `outcome=collected` requires at
  least one `proof` media row on the request → else 422 `PROOF_PHOTO_REQUIRED`.
- Resources (citizen + staff) return `photos: [{id, role, url}]` with signed URLs.

**Frontend:**

- `TextileRequestPage`: optional photo picker (preview + remove) after request
  creation; upload failure degrades gracefully (request still succeeds, toast warns).
- `TextileDispatchPage`: photo input (camera `capture="environment"` + file
  picker) inside the "Record collection" inline editor; confirm button disabled
  until a photo is attached.
- `TextileCollectionDetailPage` (citizen): before/after photo cards.

**Phase 1b (same PR, ~30 min):** `textile.rejected` email template + dispatched
automatically from `recordOutcome` on rejection. Closes SRS §4 completely
("requester is notified ... with a reason").

---

## Phase 2 — Multi-provider (DONE — engine generalized, DEMO_EWASTE partner onboarded as fixture)

**Goal:** one collection engine, N partners. Dr. Linen becomes the first
*configuration*, not the code.

| Change | Detail |
|---|---|
| Generalize the module | `textile_collection_requests` → partner-tagged collection requests; "Dr. Linen" hard labels move to config/branding |
| Category on requests | New `category` column (`clothes_waste` / `metal_scrap` / `e_waste`); existing rows migrate as `clothes_waste` |
| Partner capabilities | New config: each partner (department) declares **which categories it collects** — foundation for Phase 3 |
| Partner-owned zones | `textile_service_zones` gains a partner (department) owner — each partner manages their own service areas |
| Citizen flow | Material picker (clothes / metal / e-waste) → zone dropdown filtered to partners serving that category → same form |
| Staff desks | Already department-scoped; add category column + filter per desk |
| Branding | Citizen sees the partner's name on their booking (template variable; per-partner notification templates) |
| Reporting | Per-partner **and** per-category volume / trip / requester breakdowns |
| Data migration | Existing rows → partner = `DR_LINEN`, category = `clothes_waste`. Zero loss |
| Onboarding checklist | New partner = department → staff logins → zones → capabilities → templates. Config only |

**Login/scoping:** already works — partner staff accounts attach only to their
department (see the Dr. Linen Officer account `9999900006` pattern). Zero new
auth work per partner.

**Needs from the e-waste client before starting:** their SRS — zones, categories,
pickup methods (drop-off/premises?), notification needs, branding.

---

## Phase 3 — Cross-partner pickup (DONE — capability routing live-verified)

**Goal:** Dr. Linen can take e-waste; the other partner can take clothes — via
configuration, not code.

| Piece | Detail |
|---|---|
| Capability routing | Citizen request (category + zone) auto-assigns to the partner whose capabilities cover both. Adding `e_waste` to Dr. Linen's capabilities = settings change, zero deploy |
| Staff experience | Category filter + material badge on every stop — crew knows what they are collecting |
| Reporting | Cross-pickup volume shows per-partner **and** per-category (Dr. Linen's monthly report splits clothes vs e-waste automatically) |
| Fallback routing | If a partner rejects a request and another partner covers that category+zone → auto re-route to the backup (optional, config) |

**Business decisions needed from client (not code):**

1. **Zone overlap rule** — if two partners cover the same category in the same
   zone: primary/backup? citizen chooses? exclusive split zones?
2. **Complaint-form fate** — `metal_scrap` / `e_waste` currently sit in the
   complaint form routed to BBMP SWM. Options when the partner module launches:
   - Move the categories out of complaints entirely, or
   - Keep both, with distinct intents: complaint = *"someone dumped waste here"*
     (city clears it); booking = *"collect my items"* (partner service).
   These can legitimately coexist — needs a client decision.
3. **Branding** — does the citizen see the partner's brand, or neutral
   "collection service" wording?

---

## Sequencing and safety

- Phase 1's media linkage is **partner-agnostic** — nothing to redo in Phase 2/3.
- Phase 2's capability config **is** the foundation of Phase 3 — cross-pickup is
  a config consumer, not new architecture.
- The complaint system is untouched throughout — zero regression risk for the
  existing product.

## Current module state (baseline for this plan)

- Standalone Dr. Linen module: citizen pages (`/citizen/textile-collections/*`),
  staff desk (`/operations/textile-collections/{review,schedule,dispatch,completed}`),
  11 API routes, `textile.*` Gate abilities, 3 notification templates + listeners,
  monthly/annual reporting endpoint, 6 Pest test files.
- Volume estimates (bags / weight) are optional with an at-least-one rule.
- Demo data: 16 requests across all workflow stages; staff login `9999900006`
  (Dr. Linen Officer), citizen `9999900001`.


---

## Pending changes (client feedback, not yet implemented)

| # | Change | Detail | Status |
|---|---|---|---|
| 1 | Rebrand "CIP Karnataka" → "CIP India" | Replace across all portals (sidebar, login, page titles) | Pending |
| 2 | Rename volume labels | "Estimated bags (optional)" → "No. of bags"; "Estimated weight (optional)" → "Approximate weight". Remove "optional" from labels | Pending |
| 3 | Minimum quantity warning | Add minimum threshold per category (clothes/textiles, metal scrap, e-waste). Show a warning/info when the citizen enters below the minimum — a company cannot justify a pickup route for 1 kg. Backend validation + frontend hint | Pending |
| 4a | Drop-off point display + config | When citizen selects "Drop-off", show the nearest drop-off point address for the selected zone. Dr. Linen staff/admin can edit the drop-off point address per zone (currently hardcoded demo text in the seeder). Needs: editable `dropoff_name` + `dropoff_address` fields on the zone, editable from the partner desk or admin panel | Pending — needs discussion on who edits it (partner staff vs admin) |
| 4b | Citizen photo replace after submission | Allow the citizen to replace/retake their uploaded photo after the request is submitted (before collection). The backend already supports replace semantics (is_replaced chain) | Pending |
| 5 | Photo capture option | Add "Take a photo" (camera) alongside "Choose photo" (file picker) for the citizen photo. Use `capture="environment"` attribute or the existing CameraCapture component | Pending |
