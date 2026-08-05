# Department-Wise Routing — Implementation Plan (v3, code-audited)

Status: **Track A and Track B implementation delivered; governance items remain. Audited 2026-08-05.**
Every claim below marked ✅ verified in code, ⚠️ needs change, or ❓ needs external/governance input.
Depends on: `docs/department-routing-mapping.md` (approved mapping),
`Bengaluru_Civic_Issue_Department_Routing_Matrix_2026-08-04.xlsx` (research workbook).

---

## 1. Executive Summary

Phase 1 preserves the original eight broad citizen-facing issue categories.
Internal AI signals and routing rules resolve reports to a primary department
without exposing extra fine-grained categories in the PWA. Strict
department-scoped logins, secondary linked tasks, the operations task queue,
and the Super Admin cross-department view are implemented. Governance remains
before production rollout.

**Category boundary:** citizen categories are the eight active `report_types`;
fine-grained labels such as `pothole`, `streetlight`, and `water_leakage` are
internal routing vocabulary only.

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
| C6 | ✅ Staff report search/media access is department-scoped | `DepartmentScope.php`; report/media policies and repositories |
| C7 | ✅ Operations portal uses explicit department selection and switcher | `OperationDepartmentResolver.php`; operations context/switcher |
| C8 | ✅ Department Gate abilities are namespaced and seeded roles are used | `DepartmentServiceProvider.php`; `RolesAndPermissionsSeeder.php` |
| C9 | ✅ Demo data uses current department codes and includes assigned queue reports | `RoutingRulesSeeder.php`; `DemoUsersSeeder.php`; `DemoReportsSeeder.php` |
| C10 | ✅ Super Admin all-reports endpoint and filters exist | `AdminReportController.php`; `AdminReportRepository.php`; `AdminReports.tsx` |
| C11 | ✅ `department_users` pivot already supports users in many departments; `is_manager` flag exists (unused) | `2026_06_27_020000_create_department_users_table.php` |
| C12 | ✅ `report_assignments` already stores `department_id`, `officer_id`, timestamps, reassignment fields — extendable by **new migration only** (per AGENTS.md) | `2026_06_27_050600_create_report_assignments_table.php` |
| C13 | ✅ Routing rules are DB-configurable + cache-invalidated (admin CRUD exists) | `RoutingRepository.php` lines 26–47 |
| C14 | ✅ Departments table already has `default_sla_minutes`, `escalation_matrix`, `working_hours`, hierarchy `parent_id` — but escalation matrix is **stored, never consumed** | departments migration lines 60–61 |
| C15 | ✅ Role model ready: `department_officer`, `department_admin`, `moderator`, `super_admin` | `RolesAndPermissionsSeeder.php` |
| C16 | ✅ Active citizen categories are restored to the original 8; internal AI-label rules now precede explicit broad-category fallbacks | `2026_08_04_600000_restore_original_report_categories.php`; `2026_08_05_100000_align_routing_rules_to_broad_categories.php`; `RoutingRulesSeeder.php` |
| C17 | ✅ Secondary assignment service, department task queue, and Super Admin cross-department view exist; governance policy remains open | `SecondaryRoutingService.php`; `DepartmentTaskService.php`; `AdminReportController.php` |

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

### 3.2 Report categories — original 8 broad codes ✅
- The citizen PWA exposes only `roads`, `water_sewage`, `electricity`, `garbage`,
  `traffic_violation`, `illegal_parking`, `encroachment`, and `dead_animal`.
- Fine-grained labels remain historical/internal data and are inactive citizen
  choices. The restore migration enforces this for existing databases.

### 3.3 Routing rules ✅ aligned for Phase 1
- ✅ Admin surface already exists and is sufficient for primary routing:
  `/admin/routing-rules` offers full rule CRUD (name, priority order, conditions
  JSON in the M7 DSL, destination department, default priority, default SLA,
  active toggle, reorder endpoint) — `RoutingAdminController` (super_admin only),
  `StoreRoutingRuleRequest`.
- The canonical rule set has nine internal `ai_label_in` rules for specific
  destinations (streetlights, outages, drains, tree falls, and similar cases)
  followed by six broad `category_in` fallback rules for the eight citizen
  categories. This keeps fine-grained routing internal while ensuring every
  citizen category has a deterministic destination.
- Existing databases are updated by
  `2026_08_05_100000_align_routing_rules_to_broad_categories.php`; fresh seeds
  use the same rule set from `RoutingRulesSeeder.php`.
- The routing fallback is `routing_default_department_id` → `BBMP_ENG`.
- Primary routing remains first-match and deterministic; the condition DSL
  supports both `category_in` and `ai_label_in` ✅ C13.
- ✅ Secondary routing is implemented without rewriting the first-match engine:
  `SecondaryRoutingService` maps approved AI triggers after primary assignment,
  creates idempotent linked assignments, and preserves one primary owner.
- Secondary assignments use `kind='secondary'`, `is_primary=false`, task status,
  and per-task SLA fields (C12).

### 3.4 Data model ⚠️ (additive migrations only)
```
report_assignments  + is_primary bool default true
                    + kind enum('primary','secondary') default 'primary'
                    + sla_minutes int nullable     (per-task SLA)
                    + status enum('open','completed','cancelled') — task-level
reports             unchanged in Phase 1 (keeps single department_id = primary)
```
Delivered Track B behavior (C4, C5):
- `AiCompletedListener` / `ModerationService` guards must check **open primary
  assignment** only when deciding whether the complaint has been routed.
- `DepartmentReportRepository::assignedTo` / `dashboardCounts` must include
  reports where this department holds an open secondary task, with a clear
  primary/secondary label in the queue.
- ✅ The secondary queue shows task-level SLA, status, and completion.
- ✅ `DepartmentPolicy::view` allows the primary department or a department
  holding a linked secondary task to view the permitted report/task data.
- The primary department remains responsible for the main complaint.
- ✅ No workflow engine rewrite (C3): the report keeps one global status;
  secondary tasks track progress through assignment status and internal notes.
  A secondary department completes its task but does not independently close
  the master complaint.

### 3.5 AI categorization ⚠️ prompt + listener update
- Vision/text prompt returns the active broad category contract plus confidence,
  `secondary_triggers[]`, and `emergency_flag`.
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

### 3.7 Super Admin cross-department view — Track B ✅ implementation delivered
- All-reports index supports department, status, category, officer, date, and
  primary/secondary assignment filters.
- Resources show primary department, linked assignments, task status, SLA, and
  officer context. Authorization remains Super Admin scoped.

### 3.8 Citizen experience ✅ unchanged
One complaint, one tracking number; internal split hidden (matches workbook
`citizen_visibility` rule).

---

## 4. Track B implementation and governance gates
Track B implementation should not be considered complete until these decisions
are confirmed:

- Official SLA and escalation rules.
- Emergency dispatch policy.
- Asset ownership data for roads, lakes, poles, and similar civic assets.
- GIS/ward routing requirements and boundary data.
- Closure authority for multi-department complaints; the current proposal is
  that the primary department owns closure, with Super Admin override.

### Current pilot defaults

The current implementation follows the documented defaults while official
government sign-off remains pending:

- Provisional seeded SLAs remain admin-tunable; the official escalation matrix
  is not activated.
- Emergency flags are advisory only: they are surfaced to moderators and do
  not trigger automated dispatch.
- The primary department owns master-complaint closure; Super Admin retains
  override authority. Secondary departments complete linked tasks only.
- Asset ownership and ward/GIS routing remain deferred; category routing is
  used without geographic overrides.

Implementation delivered:

- `SecondaryRoutingService` creates idempotent linked secondary assignments.
- Operations `/operations/tasks` shows task-level status and SLA and supports
  secondary task completion without closing the master report.
- Super Admin cross-department report filters and primary/secondary views are
  available.

## 5. Phase 2 (future, gated on external inputs)
1. Master/child-task dependency ordering (`blocked-by`, utility → road restore).
2. Asset-owner-first routing (owner overrides category) — needs road/lake/pole
   ownership registries ❓ (O2).
3. Emergency triage pipeline — needs dispatch policy ❓ (O4).
4. Corp/ward GIS derivation ❓ (O3).
5. Official SLA + escalation matrix wiring (C14: matrix stored but unused today) ❓ (O1).

---

## 6. Effort — two tracks (single dev; estimates only, not commitments)

**Track A — Core routing (ship first): ~8–10 working days**
| Workstream | Range |
|---|---|
| 17 departments + 8 citizen categories + internal routing vocabulary and fallback | 1–2 d |
| Assignment migration + primary-guard fixes (C4) | 1–2 d |
| Access-isolation fixes + dept resolver/switcher (C6–C8) | 3–4 d |
| AI prompt update (8 broad categories, internal signals, secondary-trigger flags, emergency flag) | 2–3 d |
| Focused tests | 1 d |

Outcome: every complaint lands with the correct department, strict per-department
logins, AI categories per approved mapping, rules stay admin-editable.

**Track B — Multi-department: implemented; governance remains**
| Workstream | Range |
|---|---|
| SecondaryRoutingService + trigger wiring; primary-owner guard; idempotent task creation | complete |
| Operations secondary queue with task-level SLA, status, and completion | complete |
| Super Admin cross-department filters and primary/secondary assignment view (C10) | complete |
| Acceptance suite from workbook T001–T020 | complete |

**Answer to "do we need 21 days?":** No — 21 was the everything-included upper
bound. Track A alone (~2 weeks) delivers the core promise; Track B follows.

---

## 7. Open items (need governance answers — plan pauses here if unresolved)

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

## 8. Recommendation Recap
1. Ship Phase 1 approved model; schema is already shaped for Phase 2 (C12).
2. Secondary routing via AI triggers + service (option A), not engine rewrite.
3. Fix the four verified leaks/guards (C4–C8) — they are correctness issues, not polish.
4. Everything category/department stays DB-configurable (C13) — but SLA values,
   helplines and the taxonomy itself remain research-grade until O1/O7 close.
