# Client Issue Register

Source: latest client change list dated 20–21 August 2026.
Last updated: 21 August 2026 (post codebase cross-verification).

`AJ` refers to the project owner/developer. Statuses below describe the current
state in this repository; external business tasks are kept visible but are not
marked complete without evidence outside the codebase.

## Meeting note

- 20 August 2026: Meeting with Dr. Linen, Narayanan, Akshara Dinkar, AJ, and Sandhya.

This is a meeting record, not an application issue.

## Issues

| # | Client request | Status | Notes |
|---:|---|---|---|
| 1 | Change “Report” to “Complaint” across all pages. | Implemented (21 Aug) | Scope audited: ~65 citizen i18n strings (en) + ~65 Kannada lines + ~80 staff-portal strings + PWA manifest + backend notification templates. Routes, DB schema, code identifiers, `CIV-` tracking prefix, audit codes, and AI prompts stay unchanged. Implemented with recommended defaults D1–D5. |
| 2 | Change Active to Pending, Closed to Resolved, and add Pending for Submission. | Implemented (21 Aug) | Labels are fully decoupled from status codes (single shared map `shared/statusDisplay.ts`); display-only renames are functionally safe. Findings: “Active” exists only on the citizen home stats card; “Closed” never renders in UI (leaks via notification emails + audit trail DB names); “Pending for Submission” maps to the existing `draft` status — no new state needed. Implemented with defaults D6–D8 (UI journey keeps Fixed→Completed; “Closed” replaced only where it leaked). |
| 3 | Show pie charts and graphs with percentage values as numbers. | Implemented (21 Aug) | Only 2 files render charts (moderator + operations analytics). Empirically tested with installed echarts@5.6.0: pie slice labels currently show category names only — no numbers, no percentages anywhere except hover tooltips. Fix: shared label formatter (`“Approved: 12 (80%)”`) on both pies (+ optional bar labels). Implemented with default D9 (count + % on pies, bar value labels). |
| 4 | Fix the moderator approval error. | Completed | Fixed, tested, merged to `main`, and deployed on 21 August 2026. |
| 5 | Change “Report” to “Complaints” under Citizen, Moderator, Authorities, and elsewhere, except MIS. | Implemented (21 Aug) | Merged into #1. “MIS” appears nowhere in the codebase; working assumption: MIS = admin Government Dashboard (`/admin`) + department Excel/PDF/CSV exports (“Department Reports Export”) keep “Reports”. MIS assumption applied per D1. |
| 6 | Add provisions for collecting clothes and metal waste, and discarding electronic waste. | Implemented (21 Aug) | Full checklist compiled: new `report_types` rows (codes/names/icons/evidence flags), routing rules (clothes/metal fit `BBMP_SWM`’s existing dry-waste mandate; **e-waste has no owner today**), AI classifier prompt bump (new codes are invisible to the model until a new prompt version is seeded — codes are embedded at seed time), frontend icons + picker order, docs updates, tests. Implemented with defaults D10–D15 (Dr. Linen confirmed: no KSPCB — all three route to BBMP_SWM). Migration `2026_08_21_020000_add_waste_stream_categories.php` + classifier prompt v7 + seeder mirrors + docs + routing/seed tests. |
| 7 | Push data to the respective department Facebook walls if the government does not use the software. | Blocked | Requires Facebook app/page permissions, consent, privacy rules, and posting policy. |
| 8 | Explore CIP for maintenance and other activities in companies and factories. | Discovery | Needs a separate use-case and workflow review before implementation. |
| 9 | Explore adding “Survey Your School” (School Thik Karo Abhiyan). | Discovery | Needs survey owner, question model, audience, privacy, and reporting requirements. |

## Current implementation note

The moderator approval failure was caused by the previous production/runtime
issues around request throttling, service-worker registration, VAPID key loading,
and queue workers. The repaired flow passed CI and production deployment. A
fresh production end-to-end push test is still needed before calling browser
notifications fully verified in production.

## Cross-verification findings (21 August 2026)

Full read-only audits of the codebase were run for items 1/2/3/5 before any fix work.

### Key technical facts

- **Status labels are safe to rename.** All four portals render from one shared map
  (`frontend/src/shared/statusDisplay.ts`); filters, analytics, SLA logic, and CSV exports
  all operate on status *codes*. Renaming display strings breaks nothing functional.
  Changing underlying codes would break ~15 surfaces and must NOT be done.
- **“Pending for Submission” needs no new state.** The existing `draft` status already has a
  full lifecycle (server-side drafts + citizen offline IndexedDB drafts). It is a label change only.
- **Notification templates need a version bump, not a seeder edit.**
  `NotificationTemplatesSeeder` skips existing `(code, channel, locale, version=1)` rows,
  so production emails/SMS/push wording changes require version=2 template rows or a data migration.
- **Kannada requires human translation.** ವರದಿ → ದೂರು has 10+ inflected forms;
  mechanical substitution produces incorrect Kannada. Native review of all 65 lines recommended.
- **Charts:** admin/public/citizen have no chart library; the two analytics pies show slice
  names only (verified empirically). No shared chart wrapper exists — one will be created
  (`shared/ui/charts/`) so both portals share one formatter.
- **Do-not-rename guard list** (for #1/#5): `/reports*` API routes, React Router paths,
  tables `reports`/`report_types`/etc., module/class identifiers, react-query keys,
  `CIV-{YYYY}-` tracking prefix, template/audit event codes, AI prompts, analytics event names.

### Decisions needed from AJ / client before implementation

| # | Decision | Recommended default |
|---|---|---|
| D1 | Confirm MIS scope: admin Government Dashboard + export files keep “Reports”? | Yes — those two keep “Reports”; everything else renames |
| D2 | Verb phrasing: “Report an issue” → ? | “File a complaint” |
| D3 | Legal pages (Terms/Privacy) rename now or after legal review? | Rename now with care; flag for legal review |
| D4 | Notification templates: version=2 rows vs in-place v1 update? | Version=2 rows (preserves history) |
| D5 | Public transparency portal included in rename? | Yes — rename there too |
| D6 | “Closed → Resolved”: rename terminal “Completed” state to “Resolved”? Conflicts with MoM Fixed-vs-Completed distinction. | Keep UI journey as-is; only replace the word “Closed” where it leaks (emails/audit text) with “Resolved” |
| D7 | “Pending”: citizen home stat card only, or staff surfaces too? | Citizen stat card only (staff already say “Needs review”) |
| D8 | Confirm “Pending for Submission” = draft state | Yes |
| D9 | Charts: show count AND % together? Bars/lines too? | Count + % on pies; value labels on bars; lines tooltip-only |
| D10 | New waste categories: citizen-facing top-level picks, or internal AI labels under existing `garbage`? (Docs currently fix the PWA at eight broad categories.) | Citizen-facing (client explicitly asked for “provisions for collecting…”), accepting the documented-boundary change |
| D11 | Codes/names for the three categories? | `clothes_waste` “Clothes & Textiles”, `metal_scrap` “Metal Scrap”, `e_waste` “Electronic Waste (E-Waste)” + Kannada via `localizations` |
| D12 | Department routing? | Clothes + metal → `BBMP_SWM`; e-waste → `BBMP_SWM` initially (KSPCB flagged as future regulator route) |
| D13 | Evidence rules for the new types? | Platform default: photo required, 1–5 photos, no video |
| D14 | SLA / sort placement? | 2880 min target (same as garbage); picker slots 9–11 after Dead Animal |
| D15 | Should the AI classifier actively predict the new codes? | Yes — ship a new classifier prompt version including them |

Implementation of items 1/2/3/5 starts once D1–D9 are confirmed (or the recommended
defaults are accepted as-is). Item 6 starts once D10–D15 are confirmed.
