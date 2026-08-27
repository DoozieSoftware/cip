# MOM — Textile Collection Feature Changes

**Date:** 2026-08-26
**Module:** TextileCollections (Dr. Linen partner)
**Scope:** The 5 pending changes from `plans/dr-linen-partner-roadmap.md` + refinements raised during review.
**Verification gates:** `prettier --check` ✅, `eslint` ✅, `npm run build` ✅ (exit 0) on all touched files.

---

## 1. Rebrand "CIP Karnataka" → "CIP India"

- **Requirement:** Replace the "CIP Karnataka" label across all portals.
- **Resolution:** Updated the sidebar/header brand text in citizen, moderator, operations layouts and the public landing/login/push-login pages.
- **Files:** `CitizenLayout.tsx`, `ModeratorLayout.tsx`, `OperationsLayout.tsx`, `LandingPage.tsx`, `LoginPage.tsx`, `PushLoginApprovalPage.tsx`.
- **Status:** ✅ Done.

## 2. Rename volume labels

- **Requirement:** "Estimated bags (optional)" → "No. of bags"; "Estimated weight (optional)" → "Approximate weight (kg)"; drop the word "optional".
- **Resolution:** Updated the two field labels in the textile request form.
- **Files:** `citizen/components/TextileCollectionFields.tsx`.
- **Status:** ✅ Done.

## 3. Minimum quantity warning

- **Requirement:** Show a note/warning about the per-material minimum so a partner isn't dispatched for an uneconomical pickup.
- **Resolution:**
  - Added an amber info box **below "What are we collecting?"** listing the minimum for all three materials:
    - Clothes & Textiles — about 5 kg
    - Metal Scrap — about 5 kg
    - E-Waste — about 2 kg
  - Added a **reactive amber warning** in the quantity section that appears only when the entered value is below the minimum.
  - Removed the redundant static "Recommended minimum…" blue note (user feedback: "no need").
- **Files:** `citizen/pages/TextileRequestPage.tsx`, `citizen/components/TextileCollectionFields.tsx` (`minimumNote`/`minimumWarning` helpers).
- **Status:** ⚠️ Frontend complete. **Backend validation was NOT added** (plan called for "Backend validation + frontend hint"). Currently a below-minimum request can still be submitted; the warning is advisory only.

## 4a. Drop-off point display + config

- **Requirement:** When "Drop-off" is selected, show the partner's drop-off point. Staff/admin can edit `dropoff_name` / `dropoff_address` per zone.
- **Resolution — Citizen (display):**
  - Selecting "Drop-off" now replaces the *Pickup location* map with a **Drop-off location** section: name + address + a non-interactive map centered on the zone, plus an **"Open in Google Maps"** button (uses zone coordinates when present, else address search).
  - Fixed a wiring bug: `TextileCollectionFields` wrapper was not forwarding `onDropoffChange` to its inner component, so `dropoffInfo` stayed null and the pickup map always showed. Now forwarded correctly.
- **Resolution — Staff (edit):**
  - `TextileStaffDetailPage.tsx` (untracked new file) has a `DropoffEditSection` editing `dropoff_name`/`dropoff_address`, calling `PUT /textile-zones/{zone}` (`updateZone`).
  - Fixed the `service_zone` type in `operations/api/textileApi.ts` to include `dropoff_name`/`dropoff_address` (backend `TextileCollectionResource` already returns them) so the build is green.
- **Files:** `citizen/pages/TextileRequestPage.tsx`, `citizen/components/TextileCollectionFields.tsx`, `operations/api/textileApi.ts`, `operations/pages/textile/TextileStaffDetailPage.tsx` (untracked).
- **Status:** ✅ Display done; ✅ Edit UI wired. ⚠️ **Backend `updateZone` persistence + department-ownership guard not yet verified** by reading the controller body.

## 4b. Citizen photo replace after submission

- **Requirement:** Let a citizen replace/retake their uploaded photo after submission (before collection).
- **Resolution:** Added `ReplacePhotoButton` on the citizen detail page; backend `POST /citizen/textile-collections/{collection}/photo` already supports replace semantics.
- **Files:** `citizen/pages/TextileCollectionDetailPage.tsx` (earlier turn).
- **Status:** ✅ Done.

## 5. Photo capture (camera)

- **Requirement:** "Take photo" should open the camera.
- **Resolution:** Replaced the `capture="environment"` file-input (mobile-only) with the existing `CameraCapture` component (`getUserMedia`, live preview) wired to a "Take photo" button, with a Cancel control. "Choose photo" remains as the file-picker fallback. Extracted `applyPhotoFile()` so both paths share validation/preview.
- **Files:** `citizen/pages/TextileRequestPage.tsx` (import `CameraCapture`, `showCamera` state, `applyPhotoFile`).
- **Status:** ✅ Done — opens the real camera on desktop (webcam) and mobile (rear camera).

---

## Open items / follow-ups
1. **Item 3 backend validation** — add per-category minimum guard in `StoreTextileCollectionRequest` if the warning should be enforced, not just advisory.
2. **Item 4a backend check** — read `TextileCollectionController::updateZone` to confirm it persists `dropoff_name`/`dropoff_address` and enforces department ownership.
3. The `plans/dr-linen-partner-roadmap.md` "Pending changes" table still lists 1–5 as Pending — update it to reflect completion.
4. **Dirty worktree** — `TextileStaffDetailPage.tsx` and `FULL_AUDIT_2026-08-21.md` are untracked; `tmp/` is untracked. Stage deliberately, don't blanket-add.
