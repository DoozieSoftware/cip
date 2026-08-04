# Department-Wise Routing — Implementation Plan (v2, code-audited)

Status: **Proposed — audited against current codebase on 2026-08-04.**
Every claim below marked ✅ verified in code, ⚠️ needs change, or ❓ needs external/governance input.
Depends on: `docs/department-routing-mapping.md` (approved mapping),
`Bengaluru_Civic_Issue_Department_Routing_Matrix_2026-08-04.xlsx` (research workbook).

---

## 1. Executive Summary

Phase 1 ships the approved model: 15 AI categories → primary department routing,
conditional secondary tasks, strict department-scoped logins, Super Admin
cross-department filters. Phase 2 (later) adds master/child-task dependencies,
asset-owner-first routing, and emergency triage.

**Honest risk statement:** the current data model is strictly one-department-per-report.
Secondary-task support is achievable but touches the routing engine, assignment
guards, visibility policies and the operations query — it is real engineering,
not configuration. Estimates below reflect that.

---

## 2. Verified current-state constraints (code audit)

| # | Fact | Evidence |
|---|---|---|
| C1 | ⚠️ `reports.department_id` is a single nullable UUID column — one department per report | `2026_06_27_050400_create_reports_table.php` |
| C2 | ⚠️ `routing_rules.destination_department_id` is single; engine stops at **first match** | `routing_rules` migration; `RoutingEngine.php` lines 37–48 |
| C3 | ⚠️ One global status per report (`reports.current_status_id`); workflow advances report-level state only | `DefaultWorkflowSeeder.php` |
| C4 | ⚠️ Assignment guards treat **any** open assignment as "already routed" (blocks secondary creation) | `AiCompletedListener.php` lines 85–88; `ModerationService.php` line ~90 |
| C5 | ⚠️ Department visibility keys on `reports.department_id` equality only | `DepartmentReportRepository::assignedTo`; `DepartmentPolicy::view` lines 78–91 |
| C6 | ⚠️ Staff report search/media endpoints are **not** department-scoped (visibility leak) | `ReportPolicy::view` STAFF_ROLES; `ReportsController` lines 153–173; `MediaController` |
| C7 | ⚠️ Operations portal picks department via `departments()->first()` heuristic in 3 controllers | `DepartmentReportListController.php` lines 49–63; dashboard + export controllers |
| C8 | ⚠️ Legacy role `'department'` referenced in code but never seeded | `DepartmentPolicy.php` line 44 et al. |
| C9 | ⚠️ Demo data inconsistent: rules route to `BBMP_WARD_112`, demo staff attached to `BBMP` | `RoutingRulesSeeder.php`; `DemoUsersSeeder.php` |
| C10 | ⚠️ No admin all-reports endpoint exists; no category filter in staff search | `routes/api.php` admin group; `ReportRepository::baseSearch` |
| C11 | ✅ `department_users` pivot already supports users in many departments; `is_manager` flag exists (unused) | `2026_06_27_020000_create_department_users_table.php` |
| C12 | ✅ `report_assignments` already stores `department_id`, `officer_id`, timestamps, reassignment fields — extendable by **new migration only** (per AGENTS.md) | `2026_06_27_050600_create_report_assignments_table.php` |
| C13 | ✅ Routing rules are DB-configurable + cache-invalidated (admin CRUD exists) | `RoutingRepository.php` lines 26–47 |
| C14 | ✅ Departments table already has `default_sla_minutes`, `escalation_matrix`, `working_hours`, hierarchy `parent_id` — but escalation matrix is **stored, never consumed** | departments migration lines 60–61 |
| C15 | ✅ Role model ready: `department_officer`, `department_admin`, `moderator`, `super_admin` | `RolesAndPermissionsSeeder.php` |

---

## 3. Phase 1 Scope

### 3.1 Departments seed — 17 departments ✅ feasible, low risk
- 10 BBMP wings (`BBMP_ENG`, `BBMP_SWM`, `BBMP_ELEC`, `BBMP_SWD`, `BBMP_HLTH`,
  `BBMP_AH`, `BBMP_FOR`, `BBMP_TP`, `BBMP_PRK`, `BBMP_LAKE`) seeded as children of
  BBMP via existing `parent_id` (C14).
- External: BWSSB, BESCOM, BTP already seeded; add KSPCB, BMTC, PWD, BDA.
- ⚠️ Cleanup: retire demo `BBMP_WARD_112`/`BTP_TRAFFIC` inconsistency (C9) in the
  same seeder change; SLA values are **provisional defaults** ❓ (O1).
- Helplines in mapping doc: BBMP 1533, BWSSB 1916, BESCOM 1912, BTP 1095/112,
  BMTC 1800-425-1663 verified from official pages; **KSPCB/PWD/BDA numbers need
  verification before display** ❓.

### 3.2 Report categories — 15 approved codes ✅ with safe migration
- Add the 15 new `report_types` active; move current 8 to inactive — same
  mechanism already used for deprecated types (precedent: `pothole`, `streetlight` etc.).
- ⚠️ Rejected idea from v1 plan (AI reclassification of open reports) — too risky.
  Safe strategy: historical rows keep old codes (UI shows names); routing rules
  cover both old and new codes during transition.
- Citizen PWA category grid auto-shows active types ✅ (no frontend change needed
  beyond copy).

### 3.3 Routing rules ⚠️ engine change required
- Primary routing: one rule per category (condition DSL already supports
  `category_in`) ✅ C13.
- ⚠️ Secondary routing is **not** expressible today (C2: first-match-only, single
  destination). Two options:
  - **(A) recommended:** AI returns `secondary_triggers[]` alongside category; a
    new `SecondaryRoutingService` maps trigger → department and creates secondary
    assignments after the primary assignment. No change to first-match engine.
  - (B): extend engine to multi-match rules. Larger blast radius (C2, cached
    rule shape), not recommended.
- Secondary assignment = own `report_assignments` row with `kind='secondary'`
  and its own SLA countdown stored on the assignment (C12).

### 3.4 Data model ⚠️ (additive migrations only)
```
report_assignments  + is_primary bool default true
                    + kind enum('primary','secondary') default 'primary'
                    + sla_minutes int nullable     (per-task SLA)
                    + status enum('open','completed','cancelled') — task-level
reports             unchanged in Phase 1 (keeps single department_id = primary)
```
Required guard fixes (C4, C5):
- `AiCompletedListener` / `ModerationService` guards must check **open primary
  assignment** only.
- `DepartmentReportRepository::assignedTo` / `dashboardCounts` must include
  reports where this department holds any open assignment (primary or secondary),
  with a column/filter distinguishing them in the queue UI.
- `DepartmentPolicy::view` extended: member of primary dept OR holds assignment.
- ✅ No workflow engine rewrite (C3): report keeps one global status; secondary
  tasks track progress via assignment `status` + internal notes. **Known
  limitation:** a secondary dept cannot independently "resolve" the complaint —
  acceptable for Phase 1, formalized in Phase 2.

### 3.5 AI categorization ⚠️ prompt + listener update
- Vision/text prompt returns: `category` (1 of 15) + confidence,
  `secondary_triggers[]` (8 approved scenarios), `emergency_flag`.
- Existing confidence threshold + moderator-review fallback already exists ✅.
- ⚠️ Store taxonomy version used per decision (new report metadata column or
  existing JSON field — to confirm during implementation).
- Emergency handling in Phase 1 = **advisory only**: surface helpline to citizen
  and flag for moderator; no automated dispatch ❓ (O4).

### 3.6 Access control ⚠️ (fixes known leaks)
- Scope `GET /reports` staff search + media endpoints to caller's departments (C6).
- Replace `departments()->first()` heuristic with explicit department selection;
  add switcher for multi-members in operations portal (C7).
- Remove unseeded `'department'` role references (C8).
- Roles unchanged (C15); `department_admin` already limited to own departments ✅.

### 3.7 Super Admin ⚠️ new endpoint + page (C10)
- All-reports index with filters: department, status, category, date, officer.
- Multi-department badge; secondary-task add/remove via extension of existing
  reassign endpoint (super_admin/moderator).

### 3.8 Citizen experience ✅ unchanged
One complaint, one tracking number; internal split hidden (matches workbook
`citizen_visibility` rule).

---

## 4. Phase 2 (future, gated on external inputs)
1. Master/child-task dependency ordering (`blocked-by`, utility → road restore).
2. Asset-owner-first routing (owner overrides category) — needs road/lake/pole
   ownership registries ❓ (O2).
3. Emergency triage pipeline — needs dispatch policy ❓ (O4).
4. Corp/ward GIS derivation ❓ (O3).
5. Official SLA + escalation matrix wiring (C14: matrix stored but unused today) ❓ (O1).

---

## 5. Effort (rough range, single dev; estimates only, not commitments)

| Workstream | Range |
|---|---|
| Dept/category seeders + demo-data cleanup | 1–2 d |
| Assignment migration + guards (C4) | 1–2 d |
| SecondaryRoutingService + repository/policy scoping (C5) | 3–4 d |
| AI prompt + trigger mapping + versioning | 2–3 d |
| Access leak fixes + dept switcher (C6, C7, C8) | 2–3 d |
| Super Admin filters (C10) | 2 d |
| Ops-portal secondary queue + coordinated close | 2–3 d |
| Acceptance suite from workbook T001–T020 | 1–2 d |
| **Total** | **~14–21 working days** |

---

## 6. Open items (need governance answers — plan pauses here if unresolved)

| ID | Item | Why it matters | Default if silent |
|---|---|---|---|
| O1 | Official SLA/escalation matrix | SLA alerts & escalation (C14 unused today) | provisional defaults, admin-tunable |
| O2 | Asset ownership datasets (roads/lakes/poles) | Phase 2 blocker | category routing only |
| O3 | Ward/corporation GIS boundaries | Phase 2 blocker | no geo routing |
| O4 | Emergency dispatch policy | AI must not delay life-safety response | advisory helpline display only |
| O5 | Master-complaint closure authority | **proposal, not decided:** single-dept complaint closed by primary dept; multi-dept complaint closed by Super Admin | as proposed |
| O6 | Department user hierarchy (zone/division levels) | flat model today (C11 `is_manager` unused) | flat officer/admin |
| O7 | Government sign-off on taxonomy | workbook is research, not statutory order | rules stay admin-configurable (C13) so changes need no deploy |

---

## 7. Recommendation Recap
1. Ship Phase 1 approved model; schema is already shaped for Phase 2 (C12).
2. Secondary routing via AI triggers + service (option A), not engine rewrite.
3. Fix the four verified leaks/guards (C4–C8) — they are correctness issues, not polish.
4. Everything category/department stays DB-configurable (C13) — but SLA values,
   helplines and the taxonomy itself remain research-grade until O1/O7 close.
