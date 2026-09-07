# Citizen Textile UX Spec — Drop-off vs Pickup

Scope audited: `frontend/src/portals/citizen/pages/TextileRequestPage.tsx`, `pages/TextileCollectionDetailPage.tsx`, `pages/TextileCollectionsPage.tsx` (the "collection list" page), `components/TextileCollectionFields.tsx`, `api/textileZones.ts`.
Statuses are fixed by backend: `pending_review, ready_to_group, scheduled, picked_up, rejected, cancelled, missed` (`backend/app/Modules/TextileCollections/Models/TextileCollectionRequest.php:57-69`). No status may be invented here.

## JOURNEY_MAP

Two flows fork at **Collection method** (`TextileCollectionFields.tsx:412-431`). Today every screen downstream renders the pickup flow only.

| Status           | Premises (pickup) heading                   | Drop-off heading                             | Progress bar | Next-step copy                                                                                                                                                        | Map / centre                                         | Actions                                   |
| ---------------- | ------------------------------------------- | -------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| `pending_review` | "Request sent for review"                   | "Drop-off request created"                   | 1/4 · step 0 | P: "Dr. Linen reviews this in 1–2 working days. Keep bags packed and dry." D: "You do not need to wait — you can take items to the centre below any time it is open." | D: CentreCard + static map; P: pin preview           | Cancel                                    |
| `ready_to_group` | "Approved — waiting for a route day"        | "Approved — ready to drop off"               | 2/4 · step 1 | P: "We are grouping nearby collections. You'll get a pickup date soon." D: "Bring your bags to {centre}. Show reference {ref} at the counter."                        | D: CentreCard (primary), map, directions; P: nothing | Cancel, Add/replace photo                 |
| `scheduled`      | "Pickup on {date}, {window}"                | "Drop-off pass is active"                    | 3/4 · step 2 | P: "Keep bags at {address} between {window}. Crew photo confirms collection." D: "Reference {ref} is valid at the counter until {date}."                              | D: CentreCard + QR block; P: address + pin           | Cancel                                    |
| `picked_up`      | "Collected — thank you"                     | "Received at the centre — thank you"         | 4/4          | P: "Proof photo is below. We counted {actual} · {kg}." D: "The centre logged your drop-off. We counted {actual} · {kg}."                                              | D: CentreCard (muted, "for your records")            | Receipt / save, photo view, new request   |
| `missed`         | "We missed this pickup"                     | **(not applicable — see OPEN_QUESTIONS Q3)** | 3/4, amber   | "You can rebook a new request or drop off at {centre} now."                                                                                                           | D: CentreCard                                        | Rebook (deep-link new, prefilled), Cancel |
| `rejected`       | "Request not accepted" + `rejection_reason` | same                                         | 1/4, red     | Reason verbatim + "You can still drop these items off at {centre}."                                                                                                   | D: CentreCard                                        | New request, Report an issue              |
| `cancelled`      | "Cancelled" + `cancellation_reason`         | same                                         | hidden       | "This request is closed and cannot be reopened."                                                                                                                      | none                                                 | New request                               |

Every row must render a **named next action**; no status may render only a label (current behaviour, `TextileCollectionDetailPage.tsx:28-34`).

## DROPOFF_SCREENS

**1. `TextileRequestPage` — method-aware** (`TextileRequestPage.tsx:264-272, 359-381, 545-554`)

- Eyebrow/H1/subtitle and submit CTA switch on selected method: eyebrow "Collection service", H1 stays "Request a collection"; CTA = "Create drop-off plan" vs "Send pickup request".
- Drop-off panel (existing at `:359-381`) becomes the `CentreCard` component and must appear _above_ the photo section with hours + reference preview + QR placeholder.
- Submit for drop-off skips geolocation entirely (already conditional at `:359`) — keep, and stop labelling the panel "Pickup location" in any sibling copy.
- Minimum-quantity amber block (`:335-345`) is route economics; for drop-off replace with "No minimum — drop off any amount during centre hours."
- Photo helper copy: "A photo helps the centre staff recognise your bags" (drop-off) vs current "collection team" (`:418-420`).

**2. `TextileCollectionDetailPage` — drop-off variant**

- Header: reference (mono), title, status heading, method badge `Drop-off`.
- Progress: drop-off step set `Requested → Ready to drop off → Pass active → Received`.
- `CentreCard` in position 1 (before volume/dates).
- `ReferencePass` card: reference in large mono, QR, "Show this at the counter", copy-to-clipboard, `Save as image` (canvas), offline-safe (rendered client-side, no network).
- Details grid (drop-off): "Your address (for contact)" = `pickup_address`; "Estimated amount"; "Valid until" = `scheduled_date ?? batch?.collection_date`; "Centre" = centre name.
- Receipt (only `picked_up`): "Drop-off receipt" with reference, date/time `picked_up_at`, `actual_bags`/`actual_weight_kg`, centre name, proof photo, `Print / Save` (print stylesheet).

**3. `TextileCollectionsPage` — list**

- Title "Textile collections"; row shows `MethodBadge` (`Drop-off` / `Pickup`) + method-aware status label; CTA "New request" (not "Request a pickup").
- Empty: "No collection requests yet" + "Send a request when you have clothes, scrap or e-waste ready — for pickup or drop-off."
- Adopt `PageStates` (`components/PageStates.tsx:16-40`) instead of hand-rolled `isLoading/isError/length===0` branches (`TextileCollectionsPage.tsx:39-71`); the container at `:74` must not render an empty wrapper while loading.

**CentreCard structure** (new, `components/CentreCard.tsx`)

```
CentreCard { centre: { name, address, hours?: string|null, center?: {latitude,longitude}|null, reference?: string, state: 'active'|'muted' } }
  ├─ name (h3), address (address element), hours row (or "Hours not published")
  ├─ actions: Open in Google Maps (existing googleMapsUrl, TextileRequestPage.tsx:75-84 → move to shared util), Copy address
  └─ DropOffMap (extract DropOffMap from TextileRequestPage.tsx:46-72)
```

Data available today: `service_zone.dropoff_name`, `service_zone.dropoff_address` (`backend/.../TextileCollectionResource.php:56-61`) — **not in the citizen TS type** (`api/textileZones.ts:56`) and never rendered. Zone centre lat/lng is _not_ in that resource (only `center` on the zones endpoint, `TextileServiceZoneResource.php:22-25`), so map pins for stored requests need the resource delta in COMPONENT_CHANGES.

**Receipt confirmation** = render-only from `picked_up` + `actual_*` + proof photo; nothing new is persisted. Do not fabricate a receipt ID — reuse `reference` (`TextileCollectionRequest.php:110-116`).

## PICKUP_SCREENS

Gaps to fix alongside drop-off (same file, so fix in one PR):

- `rejection_reason`, `missed_pickup_reason`, `cancellation_reason`, `actual_bags`, `actual_weight_kg`, `scheduled_window_start/end`, `readiness_instructions`, `batch` are all returned by the API (`TextileCollectionResource.php:44-68`) and **none are rendered** on `TextileCollectionDetailPage.tsx` (verified: zero matches).
- `scheduled_date` renders raw ISO date with no window and no timezone/locale formatting (`TextileCollectionDetailPage.tsx:158-162`) → `Intl.DateTimeFormat('en-IN', …)` + "Between {window_start}–{window_end}".
- Progress bar hides entirely for `rejected/cancelled/missed` (`step < 0`, `:140-147`) → always render, with terminal colour.
- Bar is decorative only: `aria-label="Collection progress"` on a grid, no `role=list`, no current step announced (`:139-146`).
- `formatVolume` fallback "To be confirmed at pickup" (`:22`) is wrong for drop-off → "To be confirmed at the centre".

## COPY_FIXES

| file:line                                                                            | current                                                                | proposed                                                                                             |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `TextileRequestPage.tsx:266`                                                         | `Pickup service`                                                       | `Collection service`                                                                                 |
| `:270`                                                                               | "This is a pickup request sent to a verified local partner."           | "Send items to a verified local partner for pickup or drop-off."                                     |
| `:553`                                                                               | `Send pickup request`                                                  | conditional: `Create drop-off plan` / `Send pickup request`                                          |
| `:335-345`                                                                           | minimums "for a collection route"                                      | hide minimums when method = drop-off; add "No minimum for drop-off"                                  |
| `:418-420`                                                                           | "helps the collection team identify your items"                        | drop-off: "helps centre staff recognise your bags"                                                   |
| `TextileCollectionFields.tsx:250-252`                                                | "schedule a pickup with your local collection partner"                 | "route your request to a local partner for pickup or drop-off"                                       |
| `:395` / `:74`                                                                       | label `Pickup address`, error "Add a full pickup address."             | drop-off: label "Your address (for contact & receipt)", error "Add a full address for your receipt." |
| `:126` (`buildInitial`)                                                              | `collection_method: 'premises'` hard default                           | default = first method the zone actually offers; if neither, block + explain                         |
| `TextileCollectionDetailPage.tsx:111`                                                | `Loading pickup request`                                               | `Loading request`                                                                                    |
| `:117-118`                                                                           | "Pickup request not available / Return to your textile pickups"        | "Request not available / Return to your textile collections"                                         |
| `:131`                                                                               | `Textile pickups`                                                      | `Textile collections`                                                                                |
| `:152`                                                                               | `Pickup address`                                                       | drop-off: `Your address` (tooltip "for contact and receipt only — not a pickup point")               |
| `:160`                                                                               | `Pickup date`                                                          | drop-off: `Pass valid until`; pickup: `Pickup date`                                                  |
| `:166`                                                                               | `'Pickup from address' : 'Drop-off'`                                   | `'Pickup at your address' : 'Drop-off at a centre'`                                                  |
| `:226,238`                                                                           | "Need to cancel this pickup?" / "Cancel this pickup request"           | drop-off: "Cancel this drop-off?" / "Cancel this drop-off plan"                                      |
| `:294`                                                                               | "Collection proof will appear here after pickup."                      | drop-off: "The centre's receipt photo will appear here."                                             |
| `:28,34` labels                                                                      | "Pickup has been scheduled", "Textiles collected", "Pickup was missed" | add drop-off label map: "Drop-off pass is active", "Received at the centre", "n/a (see Q3)"          |
| `TextileCollectionsPage.tsx:7-14,27,42,47,62`                                        | all "pickup"                                                           | "collections" + method badge per row                                                                 |
| `pages/HomePage.tsx:341,347`                                                         | "My pickups" / "Request pickup"                                        | "My collections" / "Request collection"                                                              |
| `layout/CitizenLayout.tsx:32` (`nav.pickup`) + `messages/en-IN.ts:27`, `kn-IN.ts:27` | "Pickups" / "ಪಿಕಪ್‌ಗಳು"                                                | `nav.collections` → "Collections" / "ಸಂಗ್ರಹ" (both locales, keep key migration)                      |

## COMPONENT_CHANGES

New

- `components/CentreCard.tsx` — props above; loading state = skeleton rows while zone/request loads; "hours not published" fallback; never renders an empty card.
- `components/ReferencePass.tsx` — reference + client-rendered QR (`qrcode` npm, no backend change) + copy + save-image; a11y: QR is `role="img"` with `aria-label="QR code for reference DLN-…"`, reference text always visible as text (QR is never the sole carrier).
- `components/CollectionProgress.tsx` — `steps: Step[]`, `currentIndex`, `tone: 'ok'|'warn'|'bad'`; `role="list"` + `aria-current="step"`; replaces the inline grid at `TextileCollectionDetailPage.tsx:138-147`.
- `components/StatusPanel.tsx` — heading + reason block + next-step CTA, driven by a `(status, method) → copy` table exported from `pages/textileStatusCopy.ts` (new module, i18n-able).
- `components/ReceiptCard.tsx` — actuals + proof + print; `@media print` rules in the citizen stylesheet.

Changed

- `api/textileZones.ts:56` — widen `service_zone` to `{ id; code; name; dropoff_name: string|null; dropoff_address: string|null; center: {latitude,longitude}|null }`; `TextileCollectionRequest.photos` stays optional. Requires the zone `center`/`dropoff_*` addition to `TextileCollectionResource.php:56-61` (resource-only change, no migration).
- `TextileCollectionFields.tsx` — extract `MethodToggle` + method selection so `TextileRequestPage` can react without the `onDropoffChange` side-channel (`:25-30, 219-232`); emit `method` + `centre` in one callback object.
- `TextileRequestPage.tsx:46-84` — move `DropOffMap` + `googleMapsUrl` into `components/CentreCard.tsx` / `components/mapUrls.ts`.
- Tests to add/extend (regression per `AGENTS.md`): extend `components/__tests__/TextileCollectionFields.test.tsx` (method default, drop-off address label), add `pages/__tests__/TextileCollectionDetailPage.dropoff.test.tsx` (per-status headings, centre card, receipt, cancel copy) and `pages/__tests__/TextileCollectionsPage.test.tsx` (loading/empty/error via `PageStates`, method badge).

## A11Y_MOBILE

- Touch targets ≥44 px on all new controls — existing pattern is `min-h-11` (`TextileCollectionDetailPage.tsx:76`, `TextileRequestPage.tsx:556`); keep, and fix the 3-column category grid (`TextileRequestPage.tsx:303-327`) which squeezes below 44 px width on 320 px viewports → 2 columns under 360 px.
- Progress: colour-only today; add text + `aria-current`. Bar contrast `#dfddd7` on white fails 3:1 for non-text UI — darken to `var(--color-border-strong)` equivalent.
- Method toggle and category radios use `sr-only` inputs inside labels: ensure `role="radiogroup"` + `aria-label` like the category group (`TextileRequestPage.tsx:303`) — the method fieldset currently relies on `<legend>` only (`TextileCollectionFields.tsx:404-410`).
- Disabled "unavailable" method must be announced: add `aria-describedby` "Not available in this zone" rather than `opacity-50` alone (`TextileCollectionFields.tsx:460-470`).
- Hidden file input at `TextileCollectionDetailPage.tsx:84-91` is `aria-hidden` + `tabIndex=-1` driven by a JS-click button — valid, but the button needs a busy-state `aria-live="polite"` announcement for "Uploading…".
- QR/reference: text fallback always present; `Copy` button announces via existing `Toast` (`components/Toast.tsx`); `role="status"` for warnings (pattern at `TextileRequestPage.tsx:536-543`).
- Error alerts keep `role="alert"`; loading uses `Spinner label` only (no silent spinners). Add "Retry" to detail error state (`TextileCollectionDetailPage.tsx:115-119` has none — list page has one at `:49-56`).
- Print/receipt: `@media print` hides nav; receipt has `lang`-correct `dl` markup for screen readers.

## OPEN_QUESTIONS

1. **Hours.** `textile_service_zones` has `dropoff_name/dropoff_address` only (`backend/database/migrations/2026_08_25_000100_create_textile_collection_tables.php:23-24`) — no hours/phone/photo column. Spec wants hours on the card; needs a **new** migration (`dropoff_hours`, optional `dropoff_phone`) + admin/ops editing surface. Approve adding it, or ship "Hours not published" permanently?
2. **QR.** No verification endpoint exists for citizen routes (`backend/routes/api.php:438-448`). Is the QR display-only (encodes `reference`), or must centre staff scan it? Scanning needs an ops verify endpoint + policy — out of scope until confirmed.
3. **`missed` for drop-off.** Ops `recordOutcome` allows `missed` on any `scheduled` request (`TextileCollectionOperationsService.php:140-145, 182`), but "we missed you" is meaningless for a drop-off the citizen never made. Should drop-off requests be excludable from batch scheduling, or should `missed` be relabelled "Drop-off pass expired"? Needs a product decision, not a copy hack.
4. **Citizen self-declared drop-off.** Is "I dropped it off" a citizen action? It would need `POST /citizen/textile-collections/{id}/...` + a transition into `picked_up`, which currently requires a staff proof photo (`TextileCollectionOperationsService.php:198`). Assumed **no** — receipt only appears when staff record `collected`.
5. **Category vs drop-off.** `CATEGORY_NOT_SERVED` and zone methods are per-category (`TextileRequestPage.tsx:251-255`, `TextileCollectionFields.tsx:95-100`); can a category be drop-off-only in a zone (then `buildInitial` default blocks submit today)? Need seeded data confirmation.
6. **i18n.** All textile copy is hardcoded English; catalog exists (`messages/en-IN.ts`, `kn-IN.ts`). Do these screens need `t()` parity in this change, or is that a tracked follow-up?
