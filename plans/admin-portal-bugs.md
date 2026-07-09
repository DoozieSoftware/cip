# Super Admin Portal — Bug Findings (2026-07-09)

Evidence-based review of all 17 admin pages.

## Verification status in THIS environment

- **Frontend: fully verified.** `npx tsc --noEmit` → exit 0, `npx eslint
  src/portals/admin` → exit 0, `npx vitest run src/portals/admin` → **35/35
  passing** (10 test files). The 5 test mocks that encoded imaginary API shapes
  were rewritten to the real backend contract (per the doc's own warning that the
  old passing tests were false).
- **Backend: NOT executable here.** `pest` fails for 100% of cases with
  `could not find driver (sqlite)` — the PHP PDO sqlite driver is not installed
  in this environment. Every backend fix below is therefore verified by **static
  analysis only** (`php -l` clean, Pint passed, `composer dump-autoload` ok),
  **not** against a live DB. Any "verified live" phrasing below was carried over
  from earlier work and could not be re-confirmed in this environment — treat it
  as pending live confirmation.
- **Verification agent FAIL is stale:** it ran mid-fix when `tsc` had 25+ errors;
  all cited errors are since resolved (see green numbers above).

## Critical

- [x] **1. Users / Roles & Permissions / Report Types pages are read-only stubs in the UI.**
  `AdminUsers.tsx`, `AdminRoles.tsx`, and `AdminReportTypes.tsx` now each build real
  create/edit/delete forms (`UserForm`, `RoleForm` with `useSyncRolePermissions`, `ReportTypeForm`)
  wired to the previously-dead API hooks. Verified by reading the current page source.

- [x] **2. Permission catalogue disconnected from real authorization.** Fixed by wiring a new
  `BasePolicy::hasRoleOrPermission()` helper into `ModerationPolicy::viewQueue/viewAnalytics`,
  `DepartmentPolicy::viewDashboard/viewReports/viewAudit`, and the hardcoded role checks in
  `AuditLogController`/`SecurityDashboardController`. Deliberately **not** applied to
  report/department-scoped abilities (`DepartmentPolicy::view/accept/start/...`) — a permission
  check there has no concept of department membership and would reintroduce a cross-department
  data leak. Code present and `php -l`-clean; the earlier "verified live" endpoint result was from
  a prior session and **not** re-run here (backend suite not executable in this env — see top).
  `AdminRoles.tsx`'s banner updated to describe the real (partial) scope.

- [x] **3. Feature flags never gated anything.** `AiPipelineOrchestrator` now checks
  `FeatureFlagService::enabled('duplicate_detection', ...)` and `'fraud_detection'` before running
  those steps. Code present and `php -l`-clean; gating logic confirmed by reading `AiPipelineOrchestrator`
  (lines 120/124 call `FeatureFlagService::enabled(...)`), but **not** re-run live here.

- [x] **4. Security policies were ~90% decorative.** All 8 remaining keys now wired to real
  runtime behavior — verified by reading the actual call sites: `otp.expiry_seconds` →
  `OtpService::request()`; `ratelimit.otp_per_hour` → `OtpService::assertWithinRateLimit()` *and*
  `RouteServiceProvider`'s OTP rate limiter; `jwt.access_ttl_minutes` → token `expiresAt` on
  OTP/password/refresh login; `jwt.refresh_ttl_days` → `RefreshTokenService`; `session.timeout_minutes`
  → `config('session.lifetime')` in `AppServiceProvider::boot()`; `media.max_upload_mb` /
  `media.max_video_seconds` / `media.max_photos_per_report` → `UploadMediaRequest::rules()`.

- [x] **5. Retention policy was pure decoration.** New `PurgeRetentionCommand`
  (`settings:purge-retention`, daily at 03:00, gated behind `retention.purge_enabled` master
  switch, `--dry-run` supported) now reads `retention.{media,audit,notifications,security_events,ai_logs}.days`
  and deletes accordingly (media only when orphaned). `php -l`-clean; `--dry-run` path reads the
  configured targets and reports counts (logic readable in `PurgeRetentionCommand::purge()`), but
  **not** executed against a live DB here. **Found and fixed during this work**: seeder had a typo (`retribution.anonymized_reports.days`
  instead of `retention.`), and `security_events.days`/`ai_logs.days` — both read by the command
  — were never seeded so they weren't visible/editable in the UI. Fixed the typo, added the two
  missing seed rows, added a real UI toggle for `retention.purge_enabled` (there was previously no
  way to turn the master switch on from the page at all), and added an "enforced" vs
  "config only" badge per row so the UI stops overclaiming for the 4 keys nothing purges yet
  (`audit_export`, `soft_deleted`, `backup`, `anonymized_reports`).

- [x] **6. Settings save/delete used the wrong route key.** `useUpdateSetting`/`useDeleteSetting`
  now send `key` instead of `id`. Confirmed both Retention and System Config pages call it
  correctly.

## High

- [x] **7. Media Storage page** — URL path fixed (`/admin/media/storage`), shape aligned to the
  real flat resource. Type match confirmed against the controller resource fields.

- [x] **8. Scheduler page field mismatch** — `SchedulerJob` type now uses `command`/`expression`/
  `next_due_at`, matching the real service output. Verified live (empty list, but correct shape;
  no scheduled jobs seeded in this environment beyond the two `Schedule::command()` registrations,
  which don't surface here since this lists queue-visible jobs — not re-verified beyond shape
  match, low risk).

- [x] **9. Integrations page field mismatch** — now reads/writes `display_name`, `last_check_at`,
  `last_error`. Type match confirmed against the `Integration` resource.

- [x] **10. Workflow matrix field mismatch** — `TransitionMatrix` now correctly uses `s.id`,
  `s.code`, `s.is_terminal`, `t.from_state_id`, `t.to_state_id`. Read the actual rendering code;
  confirmed the lookup `Set` now keys correctly instead of `"undefined->undefined"`.

- [x] **11. Workflow builder had no create/edit UI** — `WorkflowForm` now built (states/transitions
  as JSON textareas), wired to `useCreateWorkflow`/`useUpdateWorkflow`.

- [x] **12. Routing rule creation form missing required fields** — `RuleForm` now collects
  `default_priority_id`/`default_sla_minutes` as required inputs. **Cleaned up while verifying**:
  the fields had been bolted on as a local `RoutingRuleInput` workaround type instead of the
  canonical `RoutingRule` in `client.ts` (per an inline comment flagging this as pending) — moved
  `default_priority_id`/`default_sla_minutes`/`default_officer_id` onto the real shared type and
  removed the workaround.

- [x] **13. AI Prompts tab crash** — now reads `p.prompt_text` instead of the nonexistent
  `p.template`. Confirmed via grep of the current render code (`AdminAi.tsx`).

## Medium

- [x] **14. Notification config field mismatch** — now reads/writes `display_name`. Confirmed via
  grep of the current code.

- [x] **15. Audit log `role` field mismatch** — now reads `row.roles` (array) and joins them.
  Confirmed via grep. **Pagination is improved but not fully fixed**: `per_page` was raised from
  a hardcoded 100 to the backend's max of 500, which covers this dev environment's actual data
  volume, but `AdminAuditLog.tsx` still has no page/next controls — rows beyond 500 remain
  unreachable from the UI. Low risk today, worth a follow-up if audit volume grows.

## Minor / cosmetic

- [ ] **16.** `AdminUser.deleted_at` dead field — not addressed, harmless, low priority.

## Confirmed solid — no action needed

- Platform Health, Scheduler's underlying job list, and Integration health probes are all real,
  not mocked.
- Routing engine itself is correctly wired; only the create form (#12) needed fixing.
- Dashboard counts are real live query counts.
- Pagination model is consistent (offset-based) everywhere CRUD exists.

---

## What's still genuinely open

1. **Item #15's pagination** — audit log page/next controls, if audit volume ever exceeds 500 rows
   (per_page is already raised to the backend max of 500).
2. **Item #16** — cosmetic dead field (`AdminUser.deleted_at`), optional.
3. **Backend items need a live run** — `pest` could not execute here (no SQLite PDO driver). All
   backend checks are static only; confirm against a real DB.

## Resolved this pass (2026-07-09, current environment)

Frontend (all `php -l`-free; verified by `tsc`/`eslint`/`vitest` green above):
- **#2** `AdminRoles.tsx` — amber "Not enforced" banner (catalogue informational;
  authorization is role-based + Gate abilities).
- **#5 (UI)** `AdminDataRetention.tsx` — "Not yet enforced" banner; `handleChange`
  writes `{ key, value, type:'int' }` to match the controller's key lookup.
- **#6** `client.ts` `useUpdateSetting`/`useDeleteSetting` now key on `key`.
- **#7** `AdminStorage.tsx` path/shape aligned.
- **#8** `AdminIntegrations.tsx` reads/writes `display_name`, `last_check_at`, `last_error`.
- **#9** `AdminWorkflows.tsx` — built `WorkflowForm` (create/edit) + matrix renders
  `is_terminal`/`from_state_id`/`to_state_id` to real shape.
- **#10** `AdminAi.tsx` reads `prompt_text`/`purpose`.
- **#11** → covered by #9 form work above.
- **#12** `AdminRoutingRules.tsx` — added required `default_priority_id` +
  `default_sla_minutes`, `destination_department_id` required.
- **#13** `AdminAi.tsx` prompts tab crash fixed (`prompt_text`).
- **#14** `AdminNotificationConfigs.tsx` reads/writes `display_name`.
- **#15** `AdminAuditLog.tsx` reads `roles[]`; `per_page` 100→500.
- **#1 read side** `useAuditLogs` return type corrected to `ApiEnvelope<AuditLog[]>`.
- **#1 full forms** — `AdminUsers.tsx` (`UserForm`: search, create/edit/delete, role
  checkboxes), `AdminRoles.tsx` (`RoleForm` + `useSyncRolePermissions`; create/edit + the
  partial-enforcement banner), `AdminReportTypes.tsx` (`ReportTypeForm`: create/edit/delete).
  Added the missing `useDeleteReportType` hook in `client.ts`. Payloads checked against the
  backend Form Requests (`StoreUserRequest`, `StoreReportTypeRequest`, role inline request) —
  no field drift.
- 3 new test files: `AdminUsers`/`AdminRoles`/`AdminReportTypes` `.test.tsx` (6 cases).
- 5 test files rewritten to mock the REAL backend shape (removed false-passing mocks).

Backend (code present, `php -l` clean; **not** run live — see top):
- **#2/#3/#4/#5 independently verified** by a backend verification pass (2026-07-09):
  - **#3** `AiPipelineOrchestrator` gates `duplicate_detection`/`fraud_detection` around
    the real `DuplicateDetector`/`FraudScorer` service calls (not cosmetic).
  - **#4** all 8 security-policy keys are wired to runtime call sites (OTP expiry/rate-limit,
    JWT access/refresh TTL, session lifetime override, media upload limits) — none decorative.
  - **#5** `PurgeRetentionCommand` exists, reads `retention.<entity>.days`, supports
    `--dry-run`, skips missing/zero; scheduled daily in `console.php` gated behind
    `retention.purge_enabled`; `RetentionSettingsSeeder` is registered in `DatabaseSeeder`
    (line 45) and seeds the `retention.*` keys the page edits.
  - **#2** `BasePolicy::hasRoleOrPermission()` wired into `ModerationPolicy`/`DepartmentPolicy`
    and the `AuditLogController`/`SecurityDashboardController` role checks.
  - `php -l` clean on all 12 backend files; **no gaps found, no edits required**.

## Genuinely still open
1. **Item #15's pagination** — audit log page/next controls if volume > 500 rows.
2. **Item #16** — cosmetic dead field, optional.
3. **Backend items need a live run** — `pest` could not execute here (no SQLite PDO
   driver). All backend checks above are static only; confirm against a real DB.

Everything else has been read, fixed, and verified to the extent this environment
allows (frontend: tests green; backend: static analysis only — not live requests).
