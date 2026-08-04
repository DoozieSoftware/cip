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
- 10 BBMP wings seeded as children of BBMP via existing `parent_id` (C14).

| Code | Official full form | Helpline |
|---|---|---|
| `BBMP` | Bruhat Bengaluru Mahanagara Palike (under Greater Bengaluru Authority, GBA) | 1533 |
| `BBMP_ENG` | Department of Roads & Infrastructure (BBMP Engineering) | 1533 |
| `BBMP_SWM` | Solid Waste Management Dept. (ops: BSWML — Bengaluru Solid Waste Management Ltd) | 1533 |
| `BBMP_ELEC` | Electrical Dept. — Streetlight & Park Lighting section | 1533 |
| `BBMP_SWD` | Dept. of Storm Water Drains & Lakes | 1533 |
| `BBMP_HLTH` | Health Dept. (Public Health & Clinical Health) | 1533 |
| `BBMP_AH` | Animal Husbandry Dept. (Veterinary services, stray-animal control) | 1533 |
| `BBMP_FOR` | Forest Cell / Forest & Horticulture section | 1533 |
| `BBMP_TP` | Town Planning Dept. (JDTP zonal offices) | 1533 |
| `BBMP_PRK` | Parks & Playgrounds Dept. (Horticulture) | 1533 |
| `BBMP_LAKE` | Lakes Dept. | 1533 |

- External agencies (BWSSB, BESCOM, BTP already seeded; rest to add):

| Code | Official full form | Helpline | Verified |
|---|---|---|---|
| `BWSSB` | Bangalore Water Supply and Sewerage Board | 1916 | ✅ official site |
| `BESCOM` | Bangalore Electricity Supply Company Limited | 1912 | ✅ official site |
| `BTP` | Bengaluru City Traffic Police | 1095 / 112 | ✅ official site |
| `KSPCB` | Karnataka State Pollution Control Board | 080-25589112 | ❓ needs verification |
| `BMTC` | Bangalore Metropolitan Transport Corporation Limited | 1800-425-1663 | ✅ official site |
| `PWD` | Public Works Department, Government of Karnataka | 080-22211283 | ❓ needs verification |
| `BDA` | Bangalore Development Authority | 080-23360825 | ❓ needs verification |

- ⚠️ Cleanup: retire demo `BBMP_WARD_112`/`BTP_TRAFFIC` inconsistency (C9) in the
  same seeder change; SLA values are **provisional defaults** ❓ (O1).

### 3.2 Report categories — 15 approved codes ✅ with safe migration
- Add the 15 new `report_types` active; move current 8 to inactive — same
  mechanism already used for deprecated types (precedent: `pothole`, `streetlight` etc.).
- ⚠️ Rejected idea from v1 plan (AI reclassification of open reports) — too risky.
  Safe strategy: historical rows keep old codes (UI shows names); routing rules
  cover both old and new codes during transition.
- Citizen PWA category grid auto-shows active types ✅ (no frontend change needed
  beyond copy).

### 3.3 Routing rules ⚠️ engine change required
- ✅ Admin surface already exists and is sufficient for primary routing:
  `/admin/routing-rules` offers full rule CRUD (name, priority order, conditions
  JSON in the M7 DSL, destination department, default priority, default SLA,
  active toggle, reorder endpoint) — `RoutingAdminController` (super_admin only),
  `StoreRoutingRuleRequest`.
- Currently seeded rules (all category-based): Garbage→BBMP_WARD_112 (1440m),
  Roads/Water/Electricity→BBMP_WARD_112 (1440m), Traffic/Parking/Encroachment→BTP
  (480m, high), Dead Animal→BBMP_WARD_112 (1440m); 2 legacy rules inactive;
  fallback `routing_default_department_id` → BBMP_WARD_112.
- ⚠️ Phase 1 work: replace these with 15 category rules per approved mapping
  (e.g. `streetlight`→BBMP_ELEC, `power_outage`→BESCOM, `water_leakage`→BWSSB,
  `drain_blockage`→BBMP_SWD, `noise_pollution`→KSPCB, etc.), update seeds +
  migration, re-point fallback config. Existing rules stay editable in the admin
  UI afterwards (C13) — no UI change needed.
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

## 5. Effort — two tracks (single dev; estimates only, not commitments)

**Track A — Core routing (ship first): ~8–10 working days**
| Workstream | Range |
|---|---|
| 17 departments + 15 categories + 15 rules seeders, fallback re-point, demo cleanup | 1–2 d |
| Assignment migration + primary-guard fixes (C4) | 1–2 d |
| Access-isolation fixes + dept resolver/switcher (C6–C8) | 3–4 d |
| AI prompt update (15 categories, secondary-trigger flags, emergency flag) | 2–3 d |
| Focused tests | 1 d |

Outcome: every complaint lands with the correct department, strict per-department
logins, AI categories per approved mapping, rules stay admin-editable.

**Track B — Multi-department (after A): +7–9 working days**
| Workstream | Range |
|---|---|
| SecondaryRoutingService + trigger wiring | 3–4 d |
| Ops-portal secondary-task queue + coordinated closure | 2–3 d |
| Super Admin all-reports filters (C10) | 2 d |
| Acceptance suite from workbook T001–T020 | 1–2 d |

**Answer to "do we need 21 days?":** No — 21 was the everything-included upper
bound. Track A alone (~2 weeks) delivers the core promise; Track B follows.

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
