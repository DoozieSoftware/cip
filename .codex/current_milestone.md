# Current Milestone — M3: Master Configuration & Geography

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** In Progress (11 / 24 tasks complete; T-M3-012 next)
**Last updated:** 2026-06-27 03:25 IST (after T-M3-011 done)
**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M3, `.codex/task_queue.md` §M3, `docs/02` §11 §17, `docs/03` §10 §15, `docs/04` §5 §7 §8 §14, `docs/05` §22, `docs/09` §7, `docs/13` §5, `docs/14` §19 §37, `docs/15` §6–7, `docs/16` §36

> M1 is complete (22/22) and M2 is complete (30/30). M3 lands the configuration master and the geography tree that everything downstream is built on. Geography terminates at the ward level; the master-config GET endpoint is the only API surface — every portal reads it on cold start and on cache-invalidation events.

---

## 1. Current Milestone

* **Milestone ID:** M3
* **Title:** Master Configuration & Geography
* **Estimated complexity:** **Medium**
* **Estimated duration:** 1.5 weeks
* **Total tasks:** 24 (T-M3-001 → T-M3-024)
* **Depends on:** M1 (buildable repo, CI, /health endpoint, base `Shared` utilities), M2 (User, RoleService, BasePolicy, audit middleware, rate limiters).
* **Unblocks:** M4 (Reports Domain — needs `Category`, `SubCategory`, `PriorityLevel`, `WorkflowDefinition`); M5 (Media — needs the geography tree to scope uploads); M6 (Workflow — builds on the `workflow_*` tables); M7 (Routing — needs the geography + category trees to drive assignment).

---

## 2. Objective

Land the database-driven configuration master that powers every other module. This includes the country → state → district → city → zone → ward geography tree (terminating at the ward polygon), the operational master data (departments, categories, sub-categories, priority levels, SLA policies, workflow definition, settings), the `GET /api/v1/master-config` endpoint that ships the entire config to the portals in a single response, and the Super Admin endpoints that let ops edit it.

---

## 3. Deliverables (per `.codex/roadmap.md` §M3)

* Migrations: `countries`, `states`, `districts`, `cities`, `zones`, `wards` (with `POLYGON` boundary + spatial index), `departments`, `department_geography` (M:N), `settings`, `sla_policies`, `categories`, `subcategories`, `priority_levels`, `workflow_definitions`, `workflow_states`, `workflow_transitions`.
* Eloquent models, factories, and seeders for every table above.
* `GeographyService` (tree resolver, ancestor / descendant walks, point-in-polygon check).
* `CategoryService` (resolved by ward × category × severity).
* `MasterConfigService` (assembles the cached payload for `GET /api/v1/master-config`).
* `GET /api/v1/master-config` endpoint with Redis cache + 5-minute TTL + tag-based invalidation on any config mutation.
* `POST /api/v1/admin/master-data/*` endpoints behind `super_admin` policy for every master table.
* `GET /api/v1/geography/tree` endpoint returning the country → ward tree as a nested JSON.
* OpenAPI extended for every new endpoint.
* `docs/master-data.md` authored.
* Seeders: countries (5), states (10), districts (20), cities (10), zones (10), wards (10), departments (5), categories (10), sub-categories (20), priority_levels (5), sla_policies (5), workflow_definitions (3).
* Pest feature coverage for the master-config endpoint, the geography tree endpoint, the admin write endpoints, and the cache-invalidation flow.

---

## 4. Scope

* Geography is the only master that is hierarchical; everything else is a flat lookup table.
* `boundary_polygon` on wards is application-level WKT; the driver-specific column (MySQL `POLYGON NOT NULL SRID 4326` + spatial index, SQLite `TEXT` fallback) is an implementation detail guarded by `DB::connection()->getDriverName()` so the test suite remains SQLite-portable (D-020).
* `master_config` is a single flat payload (geography + departments + categories + priorities + sla policies + workflow definitions) keyed by version; on any change the version bumps and the cache is invalidated.
* `audit_logs` rows are written for every admin write — never exposed via API.
* All Super Admin write endpoints honour `super_admin` policy and are rate-limited with the `admin` limiter.
* The geography tree endpoint is read-only and cached for 5 minutes.

---

## 5. Out of Scope

* Map rendering on the Citizen PWA — comes in M13.
* Department-portal-side admin endpoints for editing master data — comes in M11.
* Bulk import of geography / categories — comes in M12 (Super Admin).
* Tenanted department hierarchies across multiple municipalities — V1 ships single-tenant.
* Routing engine (which uses this master data) — comes in M7.

---

## 6. Exit Criteria

* All 6 geography tables exist with correct FKs; ward polygon roundtrips on both MySQL and SQLite.
* All 9 master tables exist with correct FKs and seeded with the V1 minimum.
* `GET /api/v1/master-config` returns a versioned payload < 200 KB; the response time is < 50 ms warm / < 300 ms cold.
* `GET /api/v1/geography/tree` returns the full nested tree in a single roundtrip; response is cached for 5 minutes.
* Every `POST /api/v1/admin/master-data/*` endpoint requires `super_admin`, validates input, writes an `audit_logs` row, and bumps the `master_config` version.
* Editing any master row invalidates the `master_config` Redis cache key.
* OpenAPI spec validates; Swagger UI renders every new endpoint.
* Pest feature tests for the master-config endpoint, the geography tree endpoint, the admin write endpoints, and the cache-invalidation flow all pass.
* PHPStan max level on `app/` clean; Pint clean; coverage on touched code ≥ 90 %.

---

## 7. Documents to Read Before Implementation

* `AGENTS.md` — coding rules, module ownership, never-hardcode rule.
* `docs/04` §5 (Department Domain), §7 (Workflow Domain), §8 (Location Domain), §14 (Configuration Domain).
* `docs/05` §22 (Master Config + Geography Tree APIs).
* `docs/03` §10 (Routing dependencies), §15 (Master Configuration).
* `docs/09` §7 (Super Admin — master data editing).
* `docs/16` §36 (spatial index guidance, polygon storage).
* `docs/13` §5 (UI design system for the Super Admin editor).
* `docs/11` §21 (rate limiters — `admin`).

---

## 8. Implementation Status

* **T-M3-001** Countries (uuid, iso2, iso3, phone_code, active) — **Done** (commit `200aa8`).
* **T-M3-002** States (country_id FK, code, name) — **Done** (commit `503cb3`).
* **T-M3-003** Districts (state_id FK, code, name) — **Done** (commit `47cf33`).
* **T-M3-004** Cities (district_id FK, code, name) — **Done** (commit `c6eba1`).
* **T-M3-005** Zones (city_id FK, name, code) — **Done** (commit `dd2dd53`).
* **T-M3-006** Wards with `boundary_polygon` (POLYGON + spatial index, driver-guarded) — **Done** (commit `a8efb9e`).
* **T-M3-007** Departments (UUID PK, name, unique code, parent_id self-FK with nullOnDelete, jurisdiction, address, email, phone, working_hours JSON, holiday_calendar JSON, default_workflow_id, default_sla_minutes default 2880, escalation_matrix JSON, active, soft deletes) — **Done** (commit `61e3818`).
* **T-M3-008** Department model (HasUuids + SoftDeletes, belongsTo parent (self) + hasMany children (self); M:N users relation deferred to T-M3-009 per D-009) — **Done** (commit `31d77ee`).
* **T-M3-009** department_users pivot migration (UUID PK, user_id FK → users cascadeOnDelete, department_id FK → departments restrictOnDelete, is_manager, assigned_at, unique (user_id, department_id)) — **Done** (commit `7f312bb`).
* **T-M3-010** settings migration + Setting model (key/value JSON, type, is_public, soft deletes, static get/set + type coercion) — **Done** (commit `6a87d45`).
* **T-M3-011** app_configs migration + AppConfig model (feature flags: enabled master switch, rollout_percentage 0-100, cohort JSON predicates) — **Done** (commit `b8b460a`).
* Active task: **T-M3-012 — Implement SettingsService with cache invalidation** (UUID PK, name, unique code, parent_id self-FK, jurisdiction, address, email, phone, working_hours JSON, holiday_calendar JSON, default_workflow_id, default_sla_minutes, escalation_matrix JSON, active, soft deletes).
* Blockers: none.
* Next task on completion: T-M3-013 (FeatureFlagService).
