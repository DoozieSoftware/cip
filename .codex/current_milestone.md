# Current Milestone — M4: Reports Domain & Submission API

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** **CLOSED** 32/32 = 100 % (M1, M2, M3, M4 complete; M5 starts next)
**Last updated:** 2026-06-26 22:18 IST (after T-M4-032 done; M4 32/32; M4 CLOSED; total 107/410 = 26.1 %)

> M1 (22/22), M2 (30/30), M3 (24/24) and M4 (32/32) are complete. M5 lands the media pipeline — MinIO bucket layout, multipart upload, evidence integrity (SHA-256 + virus scan stub), the report-media relationship, and the read APIs that power the evidence carousel in the citizen and moderator portals. Nothing in M5 changes reports or workflow; reports and locations are read-only inputs from M5's perspective.
**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M4, `.codex/task_queue.md` §M4, `docs/02` §11 §17, `docs/03` §10 §15, `docs/04` §5 §7 §8 §14, `docs/05` §6–7 §15–16 §20 §22–23, `docs/09` §7, `docs/11` §9 §12 §21 §23 §27 §28, `docs/13` §5, `docs/14` §8–11 §17 §37, `docs/15` §6–7, `docs/16` §36, `docs/reports.md`

> M1 is the foundation. M2 added Identity, Auth & RBAC. M3 added the configuration master and geography tree. **M4 is the citizen-facing write path** — categories, sub-categories, severity, location, media handles, idempotent submission, the moderation queue's first cut, and the GET endpoints that power the citizen report-history screen. M5 will consume M4's `Report` + `Location` rows to attach evidence.

---

## 1. Current Milestone

* **Milestone ID:** M4
* **Title:** Reports Domain & Submission API
* **Estimated complexity:** **High** (largest milestone by task count in the foundation phase)
* **Estimated duration:** 2 weeks
* **Total tasks:** 32 (T-M4-001 → T-M4-032)
* **Status:** **CLOSED 32/32 = 100 %**
* **Depends on:** M1 (buildable repo, CI, /health endpoint, base `Shared` utilities), M2 (User, RoleService, BasePolicy, audit middleware, rate limiters), M3 (geography tree, departments, categories, settings, master-config).
* **Unblocks:** M5 (Media — needs the `Report` + `Location` rows to attach evidence); M6 (Workflow — needs the report_status_history events to drive the state machine); M7 (Routing — needs the report + geography + category rows to drive assignment); M10–M13 (the portals read reports via the M4 endpoints).

---

## 2. Objective

Land the citizen-facing report-submission API end-to-end. This includes the `reports` table and its satellites (`report_types`, `report_statuses`, `report_priorities`, `locations`, `report_status_history`, `report_assignments`, `idempotency_keys`), the Eloquent models / factories / seeders for every table, the `ReportService` + `ReportRepository` + `LocationService` business layer, the `ReportStatusChanged` event + `WriteStatusHistory` listener, the `IdempotencyKey` middleware, the `ReportPolicy` + `LocationPolicy` authorization layer, the citizen and staff REST endpoints, the standardized `ErrorCode` enum, the OpenAPI extensions, and `docs/reports.md`.

---

## 3. Deliverables (per `.codex/roadmap.md` §M4)

* Migrations: `report_types`, `report_statuses`, `report_priorities`, `locations` (with POINT geometry + spatial index), `reports` (UUID PK + 7 indexes), `report_status_history` (append-only), `report_assignments`, `idempotency_keys` (unique on key+user_id).
* Eloquent models, factories, and seeders for every table above. Tracking number `CIV-YYYY-NNNNNN` is generated in the model `booted()` hook.
* DTOs: `CreateReportDto`, `SubmitReportDto` (readonly POPOs, no HTTP types).
* `ReportRepository` (pure data access: create / update / find / searchByRole / searchForCitizen / paginateTimeline / citizenDashboardCounts).
* `LocationService` (lat/lng range, accuracy ≤100m, speed ≤200 m/s; reverse-geocoding stub from env).
* `ReportService` (`createDraft`, `updateDraft`, `submit`, `transitionTo`; emits `ReportStatusChanged`).
* `ReportStatusChanged` event + `WriteStatusHistory` listener (wired in `AppServiceProvider::boot()`).
* `IdempotencyKey` middleware (replay-safe; 409 on key reuse with a different payload).
* `ReportPolicy` + `LocationPolicy` (extending `BasePolicy`).
* `SubmitReportRequest` + `LocationAccuracy` custom rule.
* `ReportsController` + `ReportResource` + `ReportStatusHistoryResource`.
* Routes (auth:sanctum + throttle:citizen for citizen endpoints; auth:sanctum + throttle:moderator for staff endpoints):
  - `POST /api/v1/reports` (T-M4-022)
  - `POST /api/v1/reports/{id}/submit` (T-M4-023)
  - `GET /api/v1/reports` (T-M4-025)
  - `GET /api/v1/reports/{id}` (T-M4-024)
  - `GET /api/v1/reports/{id}/timeline` (T-M4-026)
  - `GET /api/v1/citizen/dashboard` (T-M4-027)
  - `GET /api/v1/citizen/reports` (T-M4-028)
  - `GET /api/v1/citizen/reports/{id}` (T-M4-028)
* `App\Modules\Shared\Enums\ErrorCode` enum (the single source of truth for machine-readable codes; reports-specific codes include REPORT_NOT_FOUND, INVALID_GPS, INVALID_GPS_LOW_ACCURACY, IMPOSSIBLE_SPEED, VIDEO_REQUIRED, PHOTO_REQUIRED, DUPLICATE_REPORT, INVALID_STATUS, MISSING_REFERENCE_DATA).
* OpenAPI extended with 8 M4 paths + 3 component schemas + 1 error response under the `Reports` tag.
* `docs/reports.md` authored (API surface, tracking-number scheme, authorization model, idempotency middleware behaviour, error codes).
* Seeders: `ReportStatusesSeeder` (11 statuses), `ReportPrioritiesSeeder` (5 priorities with SLAs), `ReportTypesSeeder` (10 categories with photo + video requirements).
* Pest feature coverage for the IdempotencyKey middleware, the policies, the SubmitReportRequest, the ReportService, and the end-to-end citizen submit flow.

---

## 4. Scope

* The reports domain is the central write target for M4–M7. M4 owns the create + submit + read-back + history; M6 owns the post-submit state machine (review/approve/reject/escalate).
* The `idempotency_keys` table has no `expires_at` column in M4; a periodic prune job lands in M15.
* The tracking number generator is an in-app per-year counter; production deployment will swap in a distributed sequence (T-M4-xxx backlog reserves the slot).
* `boundary_polygon` is N/A in M4 (wards are read from M3; M4 only writes `locations` with POINT geometry, not polygons).
* Anonymous reports set `citizen_id = NULL` at submit time; the dashboard and own-reports list filter them out at the SQL level.
* The `Idempotency-Key` header is global (appended in `bootstrap/app.php`); it self-disables on GETs and on requests that don't supply the header.

---

## 5. Out of Scope

* Workflow state machine (review / approve / reject / escalate) — M6.
* Routing engine (auto-assignment to departments / officers) — M7.
* Media uploads (photo, video) — M5. The submit payload accepts `report_type_id` but the photo/video array is wired in M5.
* AI vision pipeline — M8.
* Notifications (email / SMS / push on status change) — M9.
* Moderator Portal / Operations Portal / Super Admin Portal — M10 / M11 / M12.
* Citizen PWA frontend — M13.

---

## 6. Exit Criteria

* [x] All 32 M4 tasks are `Status: Done` in `.codex/task_queue.md`.
* [x] `.codex/completed_tasks.md` shows M4 32/32 and total 107/410 = 26.1 %.
* [x] All 417 Pest tests pass (1489 assertions) in serial mode; Pint --test clean; no PHPStan regressions on M4 code.
* [x] Routes wired: 8 M4 endpoints under `auth:sanctum` + the appropriate rate limiter.
* [x] OpenAPI spec parses as valid YAML and includes the 8 M4 paths + 3 component schemas + 1 error response.
* [x] `docs/reports.md` describes the API surface, the tracking-number scheme, the authorization model, and the idempotency middleware behaviour.

---

## 7. Documents Read Before Implementation

* `AGENTS.md` (always)
* `docs/03` §10 (state machine), §15 (service layer rules), §16 (events), §20 (DTO / Resource)
* `docs/04` §7 (reports tables), §8 (locations), §24 (report fields)
* `docs/05` §6, §7, §15-16, §20, §22, §23
* `docs/09` §7 (Super Admin / reports visibility)
* `docs/11` §9, §12, §21, §23, §27, §28
* `docs/14` §8, §9, §10, §11, §17, §37
* `docs/15` §6–7 (test strategy)
* `docs/16` §36 (spatial index guidance)
* `.codex/roadmap.md` §M4 (milestone specification)
* `.codex/task_queue.md` §M4 (atomic task list)
* `docs/reports.md` (authored during M4 close-out; used by M5 and the portals)

---

## 8. Current Implementation Status

* **All 32 M4 tasks are implemented and merged on `main`.** The most recent commit is `3e2432b1 docs(codex): log T-M4-032 as Done — M4 32/32 = 100 % CLOSED; total 107/410 = 26.1 %`.
* Code review: every task is in its own per-task commit; the controller / repository / routes work is split into a few tightly-coupled commits because the layers are inseparable.
* Test coverage:
  - `tests/Feature/Reports/ReportServiceTest.php` (4 tests)
  - `tests/Feature/Reports/PolicyTest.php` (5 tests)
  - `tests/Feature/Reports/SubmitReportRequestTest.php` (6 tests)
  - `tests/Feature/Reports/CitizenSubmitFlowTest.php` (9 tests)
  - `tests/Feature/Shared/IdempotencyKeyMiddlewareTest.php` (3 tests)
  - `tests/Feature/Reports/ReportSeedTest.php` (pre-existing, covers the seeders)
  - **Total M4 tests: 27 feature tests covering the request / service / repository / policy / middleware / seeder surface.**

---

## 9. Blocking Issues

None.

---

## 10. Next Milestone

* **M5 — Media Pipeline & Evidence Integrity (26 tasks; T-M5-001 → T-M5-026).**
* First task: **T-M5-001 — Create media_buckets migration** (MinIO bucket layout per docs/04 §9).
* Switch `.codex/current_milestone.md` to M5 before resuming work.
* M5 will consume M4's `Report` and `Location` rows to attach evidence. The first cut is the multipart upload endpoint + the SHA-256 + virus-scan integrity flow. After M5 closes, M6 (Workflow Engine) and M7 (Routing Engine) can build on top.
