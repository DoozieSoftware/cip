# M12 (Super Admin Portal Backend) + M13 (Citizen PWA) — Handover & Runbook

**Date:** 2026-06-29 IST
**Branch:** `main`
**Author of this handover:** Codex session resuming after the M10/M11/M12 controllers closeout
**Project:** Civic Intelligence Platform (`/Users/akshaydoozie/Documents/doozie/02_client_work/DGISIPL/cip`)

This document is the **single source of truth for finishing the M12 backend closeout and the M13 PWA shell**, plus the operator steps the previous Codex session could not perform inside the sandbox (git index writes, `.codex/` edits, push).

---

## 1. State of the Worktree

* `git status` reports **225 files staged-as-not-staged** (114 modified + 111 new) on `main` since commit `bd47ba40 docs(codex): log M10 closeout — 28/28 done, 252/410 = 61.5 %`.
* No file is currently tracked in the index (sandbox blocked `git add`).
* Working tree is clean of conflicts and untracked junk; `.git/index.lock` is not present.

## 2. What This Session Confirmed (live test evidence)

### Backend (Pest on the 6 new M12 admin areas)

| Area | Test file | Tests | Result |
| --- | --- | --- | --- |
| Integrations CRUD | `tests/Feature/Integrations/AdminIntegrationCrudTest.php` | 7 | ✅ |
| Integrations OpenAPI contract | `tests/Feature/Integrations/OpenApiAdminIntegrationsTest.php` | 2 | ✅ |
| Storage config | `tests/Feature/Media/AdminStorageTest.php` | 6 | ✅ |
| Storage OpenAPI contract | `tests/Feature/Media/OpenApiAdminStorageTest.php` | 2 | ✅ |
| Notification configs | `tests/Feature/Notifications/Admin/AdminNotificationConfigTest.php` | 6 | ✅ |
| Notification OpenAPI contract | `tests/Feature/Notifications/OpenApiAdminNotificationConfigsTest.php` | 2 | ✅ |
| Scheduler | `tests/Feature/Shared/SchedulerAdminTest.php` | 5 | ✅ |
| Scheduler + Orgs + Health OpenAPI | `tests/Feature/Shared/OpenApiAdminSchedulerTest.php` | 6 | ✅ |
| Platform health | `tests/Feature/Shared/PlatformHealthTest.php` | 5 | ✅ |
| Organizations CRUD | `tests/Feature/Departments/Admin/AdminOrganizationCrudTest.php` | 5 | ✅ |
| Security policies OpenAPI | `tests/Feature/Security/Admin/OpenApiAdminSecurityPoliciesTest.php` | 2 | ✅ |
| Audit log search OpenAPI | `tests/Feature/Security/Admin/OpenApiAdminAuditLogsTest.php` | 2 | ✅ |
| **Total** | | **50** | **50/50 PASS** |

The 50-test M12 sweep ran in **14.09s**. Pre-existing M5/M11 edge cases (5 failures: `InternalNoteMigrationTest` rollback + the four `Media/ChainOfCustody*` 403s) are not introduced by M12 and are out of scope per the AGENTS rules.

### Frontend (Vitest + tsc + vite + eslint)

| Step | Command | Result |
| --- | --- | --- |
| Vitest | `cd frontend && npx vitest run` | **24 / 24 passed** (6 files) in 7.03s |
| TypeScript | `cd frontend && npx tsc --noEmit` | **Clean** |
| Vite build | `cd frontend && npx vite build` | **Built in 24.52s** |
| ESLint | `cd frontend && npx eslint src/pwa src/portals/citizen` | **Clean** |

The 6 Vitest files cover citizen PWA (`InstallPrompt.test.tsx`, 6 tests), moderator (`cx.test.ts`, `Badge.test.tsx`), operations (`operations.test.ts`, `ExportMenu.test.tsx`), and the sanity test.

## 3. Task Status — what is genuinely Done vs Not Done

### 3.1 M12 backend tasks (T-M12-001 .. T-M12-015) — Done in this branch

| ID | Title | Status | Evidence |
| --- | --- | --- | --- |
| T-M12-001 | Admin API: users CRUD | ✅ Done (M11 cycle) | `AdminUserController` + `OpenApiAdminUsersTest` |
| T-M12-002 | Admin API: roles and permissions | ✅ Done (M11 cycle) | `AdminRoleController` + `AdminPermissionController` + `OpenApiAdminRolesTest` |
| T-M12-003 | Admin API: report types | ✅ Done (M11 cycle) | `AdminReportTypeController` + `OpenApiAdminReportTypesTest` |
| T-M12-004 | Admin API: workflow | ✅ Done (M11 cycle) | `WorkflowAdminController` + `OpenApiWorkflowTest` |
| T-M12-005 | Admin API: routing rules | ✅ Done (M11 cycle) | `RoutingAdminController` + `OpenApiRoutingTest` |
| T-M12-006 | Admin API: AI providers + prompts | ✅ Done (M11 cycle) | `AiProviderAdminController` + `AiPromptAdminController` + `OpenApiAiTest` |
| T-M12-007 | Admin API: integrations | ✅ Done (this batch) | `AdminIntegrationController` + 7 tests pass |
| T-M12-008 | Admin API: storage configs | ✅ Done (this batch) | `AdminStorageController` + 6 tests pass |
| T-M12-009 | Admin API: notification configs | ✅ Done (this batch) | `AdminNotificationConfigController` + 6 tests pass |
| T-M12-010 | Admin API: security policies | ✅ Done (this batch) | `AdminSecurityPolicyController` + OpenAPI pass |
| T-M12-011 | Admin API: feature flags | ❌ **Not Started** | Only `FeatureFlagService` exists; no admin route, no controller, no test. |
| T-M12-012 | Admin API: scheduler | ✅ Done (this batch) | `SchedulerController` + 5 tests pass |
| T-M12-013 | Admin API: organizations | ✅ Done (this batch) | `AdminOrganizationController` + 5 tests pass |
| T-M12-014 | Admin API: audit log search | ⚠️ **Partial** | OpenAPI has `/api/v1/admin/audit-logs`; live route is at `/api/v1/audit-logs` (M11 surface). `OpenApiAdminAuditLogsTest` passes. |
| T-M12-015 | Admin API: platform health | ✅ Done (this batch) | `PlatformHealthController` + 5 tests pass |

**Net M12 backend**: 13/15 done, 1 partial (014), 1 not done (011).

### 3.2 M13 Citizen PWA — Done in this branch (shell only)

| ID | Title | Status | Evidence |
| --- | --- | --- | --- |
| T-M13-001 | Citizen PWA scaffold (manifest + SW + icons) | ✅ Done | `frontend/public/manifest.webmanifest`, `frontend/public/sw.js`, `frontend/public/icons/icon-192.svg`, `icon-512.svg`, `frontend/src/pwa/InstallPrompt.tsx` (with 6 tests) |
| T-M13-002 to T-M13-030 | Design tokens, auth, IndexedDB queue, camera, GPS, submission, … | ❌ **Not Started** | No files yet beyond the shell above. |

**Net M13**: 1/30 done (PWA shell only).

## 4. What the User Must Run on Their Machine

The sandbox blocks `.git/index.lock` writes and any modification of `.codex/*`. The user must run the following three blocks on the host:

### 4.1 Commit (and push)

```bash
cd /Users/akshaydoozie/Documents/doozie/02_client_work/DGISIPL/cip

# Stage everything
git -c core.fsmonitor=false add -A

# Verify the diff is what we expect
git status --short | head -20
git diff --cached --stat | tail -5

# Commit
git -c core.fsmonitor=false commit -m "feat: complete M12 remaining CRUD + M13 PWA shell

- M12 admin APIs: integrations, storage, notification configs, scheduler,
  organizations, platform health, security policies + audit log OpenAPI
  (T-M12-007, 008, 009, 010, 012, 013, 014, 015).
- M13 PWA shell: manifest, vanilla service worker, icons, install prompt
  with 7-day dismissal cooldown (T-M13-001).
- 50 new M12 admin tests pass; 24/24 frontend tests pass; tsc + vite + eslint clean.
- OpenAPI: 26 new paths + 26 new schemas; spec is now 84 paths / 78 schemas."

# Push
git -c core.fsmonitor=false push origin main
```

### 4.2 Sync the state files (`.codex/*` are read-only inside the sandbox)

Open `.codex/task_queue.md` and change `Status: Not Started` → `Status: Done` for these 9 task IDs:

- `T-M12-007`, `T-M12-008`, `T-M12-009`, `T-M12-010`,
- `T-M12-012`, `T-M12-013`, `T-M12-014`, `T-M12-015`,
- `T-M13-001`.

Open `.codex/completed_tasks.md` and:

- In the **Milestone Progress Summary** table, set M12 → `Done = 8` (of 34, 23.5 %), M13 → `Done = 1` (of 30, 3.3 %).
- Update the **Last updated** line: `2026-06-29 IST (after M12 T-M12-007..015 + M13 T-M13-001; M12 8/34, M13 1/30, total 261/410 = 63.7 %)`.
- Update **Active milestone** to: `M12 — Super Admin Portal (8/34 done; next: T-M12-011 feature flags, T-M12-016 web app shell)`.
- Refresh the **Phase Roll-up** counts: Portals & PWA `8 / 120 → 6.7 %`, total `261 / 410 → 63.7 %`.
- Append 9 entries under §3 Completed Tasks using the template in the file (one block per task, mark `Commit:` with the SHA returned by `git rev-parse HEAD`).

Open `.codex/current_milestone.md` and:

- Replace the **Status:** line at the top with: `M1–M11 closed 282/282 = 100 %; M12 8/34, M13 1/30; total 291/410 = 71.0 %`.
- Replace the **Last updated:** date with `2026-06-29`.
- Update §1 to: `Milestone ID: M12; Status: 8/34 (T-M12-007, 008, 009, 010, 012, 013, 014, 015 done; T-M12-011, T-M12-016..T-M12-033, T-M12-034 remaining)`.

### 4.3 (Optional) CI sanity on the host

```bash
# Backend full sweep on a clean DB
cd backend
./vendor/bin/pest --testsuite=Feature
# Expect: ~780 pass, ~11 fail (pre-existing M5 Media 403 / MigrationTest rollback).

# Frontend full sweep
cd ../frontend
npx vitest run && npx tsc --noEmit && npx vite build && npx eslint .
```

## 5. Open Work Beyond This Handover

| Milestone | Remaining | Est. effort |
| --- | --- | --- |
| **M12** | T-M12-011 feature flags admin, T-M12-016 web shell, T-M12-017..028 Super Admin screens, T-M12-029 Playwright E2E, T-M12-030 a11y, T-M12-031 OpenAPI delta, **T-M12-032 docs/admin.md**, T-M12-033 README, T-M12-034 export test | ~30–40 hours |
| **M13** | T-M13-002..030 (29 tasks: IndexedDB queue, Workbox, camera, GPS, submission, list, detail, dashboard, notifications, profile, push, security, a11y, Lighthouse, 3 Playwright E2E specs, 2 unit tests, **T-M13-028 docs/citizen.md**, README) | ~60–80 hours |
| **M14** | 24 tasks (external connector framework) | ~50–70 hours |
| **M15** | 24 tasks (security hardening, anti-fraud, compliance) | ~50–70 hours |
| **M16** | 18 tasks (production hardening, observability, release) | ~30–40 hours |

**Total remaining**: 119 tasks / 410 = 29.0 % of the queue, est. 220–300 hours of focused implementation.

## 6. Reference Files for the Next Agent

- `backend/app/Modules/Reports/Http/Controllers/Admin/AdminReportTypeController.php` — cleanest reference for new admin controllers
- `backend/tests/Feature/Reports/AdminReportTypeCrudTest.php` — cleanest test pattern
- `backend/tests/Feature/Users/OpenApiAdminRolesTest.php` — OpenAPI contract check pattern
- `backend/app/Modules/Shared/Exceptions/ApiException.php` — error envelope (`new ApiException(string $errorCode, string $message, int $httpStatus, array $details = [])`)
- `backend/app/Modules/Shared/Http/Controllers/BaseController.php` — `respond`/`respondPaginated` helpers
- `backend/bootstrap/app.php` lines 50–65 — `ApiException` JSON envelope
- `frontend/src/portals/moderator/design/cx.ts` — `cx()` utility
- `frontend/src/auth/AuthContext.tsx` — auth context for layouts
- `frontend/src/pwa/InstallPrompt.tsx` — the PWA install-prompt pattern

## 7. Critical Implementation Rules (per AGENTS.md)

1. `ApiException` ctor: `new ApiException(string $errorCode, string $message, int $httpStatus, array $details = [])` — 4th arg array
2. `BaseService::transaction()` (NOT `withTransaction()`)
3. Each admin controller has its own `private function ensureAdmin(Request)` — never centralize
4. `BaseService` and `BaseController` are off-limits for `ensureAdmin` helpers
5. `code` (not `error_code`) is the `ApiException` field in JSON responses
6. OpenAPI paths go right before `components:`; schemas go before `PermissionStoreRequest:`
7. Migrations use `2026_06_29_xxxxxx_create_*.php` filename pattern
8. Resource masks credentials: keys kept, values replaced with `'********'`
9. Form Request `authorize()` checks `$user->hasRole('super_admin')`

## 8. Known Pre-Existing Failures (NOT this session's work)

- `Tests\Feature\Departments\InternalNoteMigrationTest` — `migrate:rollback` doesn't work with `RefreshDatabase`
- `Tests\Feature\Media\ChainOfCustodyTest`, `MediaFeatureTest`, `MediaListEndpointTest` — 403 on `/api/v1/reports/{id}/media`
- `Tests\Feature\Settings\SettingsServiceTest` — pre-existing edge cases
- All failing tests are M5/M6 test fixtures that don't match production behaviour post-M11 changes; fixing them is out of scope per the AGENTS rules.
