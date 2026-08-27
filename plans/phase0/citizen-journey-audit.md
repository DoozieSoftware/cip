# Textile Drop-Off Journey Audit (READ-ONLY)

Files audited (actual names; no `TextileCollectionListPage` or `citizenApi.ts` exist):
`frontend/src/portals/citizen/pages/TextileRequestPage.tsx` (request page),
`components/TextileCollectionFields.tsx`, `pages/TextileCollectionDetailPage.tsx`,
`pages/TextileCollectionsPage.tsx` (the list page), `api/textileZones.ts` (the citizen API module).

**Status-vocab correction:** `collected` and `missed_pickup` are **not** API statuses. Backend statuses are `pending_review, ready_to_group, scheduled, picked_up, rejected, cancelled, missed` (`backend/app/Modules/TextileCollections/Models/TextileCollectionRequest.php:60,62,64,66,68,70,72`). `collected`/`missed` are _outcome verbs_ that map to `picked_up`/`missed` (`.../Services/TextileCollectionOperationsService.php:134,141`; `.../Http/Requests/RecordCollectionOutcomeRequest.php:22`). Frontend label keys are `missed`, not `missed_pickup` (`TextileCollectionDetailPage.tsx:32`, `TextileCollectionsPage.tsx:12`).

## STATUS-VIEW

Detail page drives all copy from `LABELS` (`TextileCollectionDetailPage.tsx:27-35`), 4-step bar from `STEPS` (`:26`), `step = STEPS.indexOf(status)` (`:122`), bar gated on `step >= 0` (`:139-147`), cancel gated `!['picked_up','cancelled','rejected']` (`:123`, rendered `:185-243`). No "next step" / "what happens next" element exists on the page for **any** status.

| status                 | heading (file:line)                                                                  | progress bar                       | next step shown                                                                                                                                       | citizen action                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| pending_review         | "Dr. Linen is reviewing your request" `:28`                                          | 1/4 filled `:140-147`              | **none**                                                                                                                                              | Cancel `:226-240`; Replace photo `:69-92`                                            |
| ready_to_group         | "Approved and waiting to be grouped by area" `:29`                                   | 2/4                                | **none**; still shows "Pickup date: Not scheduled yet" `:160-161`                                                                                     | Cancel                                                                               |
| scheduled              | "Pickup has been scheduled" `:30`                                                    | 3/4                                | **none**; shows `scheduled_date` `:161`; `scheduled_window_start/end`, `readiness_instructions` (declared `api/textileZones.ts:52-53`) never rendered | Cancel                                                                               |
| picked_up              | "Textiles collected" `:31`                                                           | 4/4                                | **none**; `actual_bags`/`actual_weight_kg`/`picked_up_at` (`api/textileZones.ts:47-57`) never rendered; proof photo appears `:282-300`                | none (cancel hidden `:123`)                                                          |
| collected              | _not a status_; if received → raw string `"collected"` via fallback `:138`           | **hidden** (`step=-1`, `:122,139`) | none                                                                                                                                                  | none                                                                                 |
| missed / missed_pickup | "Pickup was missed" `:32`; `missed_pickup` key absent → raw `"missed_pickup"` `:138` | **hidden** (`step=-1`)             | **none**; `missed_pickup_reason` never rendered                                                                                                       | Cancel (`missed` not in deny-list `:123`) — only option, and it destroys the request |
| rejected               | "Request was not accepted" `:33`                                                     | **hidden**                         | **none**; `rejection_reason` never rendered                                                                                                           | **none**                                                                             |
| cancelled              | "Request cancelled" `:34`                                                            | **hidden**                         | **none**; `cancellation_reason` never rendered                                                                                                        | **none**                                                                             |

List page (`TextileCollectionsPage.tsx`) shows only title/reference + status label `:81-92`; labels `:8-14`; no method (drop-off vs pickup) badge.

## DROPOFF-GAPS

1. `TextileRequestPage.tsx:266` eyebrow "Pickup service"; `:268` H1 "Request a collection"; `:270` "This is a pickup request sent to a verified local partner."; `:553` submit button "Send pickup request" — all static, none react to `dropoffInfo` (`:359-380` is the only drop-off-aware block).
2. `TextileCollectionFields.tsx:255` — "We use this to schedule a pickup with your local collection partner once your request is reviewed." shown even when Drop-off is selected.
3. `TextileCollectionFields.tsx:76-77,395` — **Pickup address is a hard requirement (min 10 chars) for drop-off users too**; error text "Add a full pickup address."
4. `TextileCollectionFields.tsx:119` — `buildInitial` defaults `collection_method: 'premises'`; in a drop-off-only zone the premises toggle is disabled (`:424-431` + `:99-101`) but the draft stays `premises`, so the user sees a blocking "Premises pickup is not available in this zone" with no auto-correction.
5. `TextileCollectionFields.tsx:135,141,147` — minimum-quantity warnings talk about "a pickup route"/"pickup" regardless of method.
6. `TextileRequestPage.tsx:445` photo helper "A photo helps the collection team identify your items" — pickup framing.
7. Detail page has **no drop-off point card**. Backend returns `service_zone.dropoff_name`/`dropoff_address` (`Http/Resources/TextileCollectionResource.php:52-57`), but the TS type drops them: `service_zone: { id; code; name } | null` (`api/textileZones.ts:60`). After submit, the drop-off address the user saw on the form is **unrecoverable** in the UI.
8. `TextileCollectionDetailPage.tsx:152` "Pickup address" and `:160-161` "Pickup date / Not scheduled yet" render unchanged for drop-off.
9. `TextileCollectionDetailPage.tsx:26,140` — 4-step bar `pending_review → ready_to_group → scheduled → picked_up` is a pickup pipeline; drop-off has no "arrived at collection point" concept.
10. `TextileCollectionDetailPage.tsx:166` — method cell renders only the word "Drop-off" with no address or instructions beside it.
11. `TextileCollectionsPage.tsx:27,29,42,47,62,69` — "Textile pickups", "Loading textile pickups", "No textile pickup requests", "Request a pickup".
12. No citizen route to signal a drop-off was completed: citizen textile routes are only index/show/cancel/photo (`backend/routes/api.php:438-439` + cancel/photo siblings); no "mark delivered".

## DEAD-ENDS

- `rejected` and `cancelled`: zero actions (cancel hidden `:123`) and zero explanation (reason fields fetched but unrendered) — user cannot learn why or rebook.
- `missed`: cancel is the _only_ button, and copy at `:228-229` says a cancelled request "cannot be reopened — you would have to book a new one" while rendering no link to do so.
- `pending_review` / `ready_to_group`: no timeframe, no contact channel, no "what happens next".
- `scheduled`: date only; no time window (`scheduled_window_start/end` unused) and zone `readiness_instructions` unused (`api/textileZones.ts:52`).
- `picked_up`: no receipt/confirmation of actual quantity (`actual_bags`/`actual_weight_kg` unused).
- Unknown/renamed statuses (`collected`, `missed_pickup`) fall through to `LABELS[status] ?? status` (`:138`) **and** lose the progress bar entirely (`:122,139`) — silent raw-enum leak.
- Drop-off user in a drop-off-only zone is blocked at submit by the premises error (gap #4) — a hard dead end on the request form.

## COPY-CHANGES

Minimum set (method-aware rendering; no new endpoints/columns invented):

| file:line                                    | current                                                            | drop-off replacement                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| TextileRequestPage.tsx:266                   | "Pickup service"                                                   | "Collection service"                                                                                                           |
| TextileRequestPage.tsx:270                   | "This is a pickup request sent to a verified local partner."       | "This request is sent to a verified local partner for pickup or drop-off."                                                     |
| TextileRequestPage.tsx:553                   | "Send pickup request"                                              | "Send drop-off request" when `dropoffInfo` else keep                                                                           |
| TextileCollectionFields.tsx:255              | "…to schedule a pickup with your local collection partner…"        | "…to route your request to the local partner. For drop-off you will get the collection point address."                         |
| TextileCollectionFields.tsx:395,76-77        | "Pickup address" / "Add a full pickup address."                    | "Your address" / "Add an address we can reach you at." (drop-off), or make optional when `collection_method === 'dropoff'`     |
| TextileCollectionFields.tsx:135/141/147      | "A pickup route may not be economical."                            | "This is below the recommended minimum." (method-neutral)                                                                      |
| TextileCollectionFields.tsx:119              | default `collection_method: 'premises'`                            | default to first method the selected zone actually offers                                                                      |
| TextileCollectionDetailPage.tsx:30,32        | "Pickup has been scheduled" / "Pickup was missed"                  | method-aware: "Your drop-off point is confirmed" / reword or suppress for drop-off                                             |
| TextileCollectionDetailPage.tsx:152,160-161  | "Pickup address", "Pickup date / Not scheduled yet"                | drop-off: "Collection point" (`service_zone.dropoff_name/address`) + "Open when / Hours"; drop "Pickup date" row               |
| TextileCollectionDetailPage.tsx:166          | "Drop-off"                                                         | "Drop-off — you bring items to the collection point"                                                                           |
| TextileCollectionDetailPage.tsx:226,238      | "Need to cancel this pickup?" / "Cancel this pickup request"       | "Need to cancel this request?" / "Cancel this request"                                                                         |
| TextileCollectionDetailPage.tsx:228-229      | "…you no longer need this visit…"                                  | drop-off: "…you no longer need this drop-off."; add a "New request" link beside the "book a new one" sentence                  |
| TextileCollectionDetailPage.tsx:27-35        | pickup-only headings; keys missing for `collected`/`missed_pickup` | add method-aware variant + a human fallback so raw enums never render                                                          |
| TextileCollectionsPage.tsx:27,29,42,47,62,69 | "Textile pickups", "Request a pickup", etc.                        | "Textile collections" / "Request a collection"                                                                                 |
| TextileCollectionsPage.tsx:8-14              | `scheduled: 'Pickup scheduled'`, `missed: 'Pickup missed'`         | method-aware labels, or neutral "Scheduled" / "Missed" + a drop-off/pickup badge on each row (`:81-92`)                        |
| TextileCollectionDetailPage.tsx (new)        | no next-step block                                                 | one "What happens next" line per status; render `rejection_reason`, `cancellation_reason`, `missed_pickup_reason` when present |
| api/textileZones.ts:60                       | `service_zone: { id; code; name }`                                 | add `dropoff_name`, `dropoff_address` (already sent by `TextileCollectionResource.php:55-56`)                                  |

Structural minimum: (a) detail page must branch on `item.collection_method === 'dropoff'`; (b) a "What happens next" block per status; (c) reasons rendered; (d) a rebook CTA on terminal states; (e) method badge on list rows.

## TEST-GAPS

- **No test file for the list page at all** (`frontend/src/portals/citizen/pages/__tests__/` contains no `TextileCollections*.test.tsx`); zero coverage of labels `TextileCollectionsPage.tsx:8-14` or empty/error states (`:40-73`).
- `pages/__tests__/TextilePhotoFeatures.test.tsx:379-450` covers only the photo trust view, at `picked_up`/`scheduled`; asserts no status heading, progress-bar fill, cancel visibility, or drop-off rendering.
- No test that an unknown status (`collected`, `missed_pickup`) yields a human heading and a bar decision — the `:138`/`:139` fallback path is untested.
- `components/__tests__/TextileCollectionFields.test.tsx:130` covers drop-off point propagation and `:222` drop-off-disabled; **not covered**: `pickup_address` required for a drop-off payload (`:76-77`), premises default in a drop-off-only zone (`:119`), method-aware minimum warnings (`:135`).
- No test that `TextileRequestPage` swaps heading/CTA/location section when method is `dropoff` (`:266-270,:359-380,:553`); `TextilePhotoFeatures.test.tsx:155-312` only exercises photo + category flows.
- No cancel-flow test (reason validation `:189-206`, hidden-for-terminal `:123`); backend cancel rule (`TextileCollectionController.php:259-265`) untested from the client.
- No e2e coverage: `frontend/e2e/` has no textile spec (`grep -rln textile frontend/e2e` → empty), so the drop-off journey is untested end-to-end.
