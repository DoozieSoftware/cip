# Department-Wise Routing — Implementation Plan

Status: **Proposed plan for CTO review**
Date: 2026-08-04
Depends on: `docs/department-routing-mapping.md` (approved routing reference),
`Bengaluru_Civic_Issue_Department_Routing_Matrix_2026-08-04.xlsx` (research workbook)

---

## 1. Executive Summary

We will make CIP route every Bengaluru civic complaint to the **correct department**
using AI categorization, enforce **per-department data isolation**, and support
**multi-department coordination** for issues that involve two agencies.

**Recommendation: deliver in 2 phases.**

- **Phase 1 (build now):** the approved model — 15 complaint categories,
  10 BBMP wings + external agencies as departments, AI classification to a
  primary department, optional secondary (CC) department, strict department
  logins, Super Admin cross-department filters.
- **Phase 2 (next):** upgrade multi-department handling to the Excel workbook's
  full model — master ticket + per-department child tasks with dependency
  ordering, emergency triage, and coordinated closure. Phase 1's schema is
  designed to be forward-compatible with this.

Why phased: Phase 1 matches the approved reference doc and can be shipped and
demoed to GBA/agencies quickly. Phase 2 needs governance decisions that are
still open (closure authority, SLA matrix, emergency dispatch policy — see §6).

---

## 2. Goals / Non-Goals

### Goals
1. AI categorizes each complaint into one of 15 approved categories.
2. Complaint is routed to exactly one **primary department** (root-cause owner).
3. When a secondary trigger applies (e.g. traffic obstruction), a **linked
   secondary task** goes to the second department.
4. Each department login sees **only its own** complaints/tasks.
5. Super Admin sees everything, filterable by department / status / category / date.
6. Category → department mapping is admin-configurable (routing rules), not hardcoded.

### Non-Goals (deferred)
- Ward-level / zone-level assignment and location geofencing.
- Asset-owner verification against road/lake/pole registries (Phase 2+;
  requires government asset data we do not yet have — see Validation Gaps).
- Automated emergency dispatch (101/112 calling) — Phase 2, needs policy sign-off.

---

## 3. Phase 1 Scope (approved model)

### 3.1 Departments seed (17 departments)

BBMP wings (all under BBMP organization, code prefix `BBMP_`):

| Code | Wing | Handles |
|---|---|---|
| `BBMP_ENG` | Road Maintenance | roads, potholes, footpaths, stagnation |
| `BBMP_SWM` | Solid Waste | garbage, sweeping, dead animals, burning |
| `BBMP_ELEC` | Electrical / Streetlight | streetlights, park lights, junction boxes |
| `BBMP_SWD` | Storm Water Drain | SWD blockage, desilting, drain damage |
| `BBMP_HLTH` | Health | fogging, unhygienic premises, toilets |
| `BBMP_AH` | Animal Husbandry | stray dogs/cattle, bites, licensing |
| `BBMP_FOR` | Forest & Horticulture | trees, branches, wildlife coordination |
| `BBMP_TP` | Town Planning | bye-law violations, illegal construction |
| `BBMP_PRK` | Parks & Playgrounds | parks, equipment, playgrounds |
| `BBMP_LAKE` | Lakes | lake encroachment, fencing, sewage inflow |

External agencies:

| Code | Agency |
|---|---|
| `BWSSB` | Water supply & sewerage |
| `BESCOM` | Power distribution |
| `BTP` | Traffic Police |
| `KSPCB` | Pollution Control Board |
| `BMTC` | Transport corporation |
| `PWD` | Public Works (state roads) |
| `BDA` | Development Authority |

Each department gets: `default_sla_minutes`, `escalation_matrix` (JSON),
working hours, jurisdiction text. SLA values are **provisional defaults** until
official SLA matrix is procured (open item O1).

### 3.2 Report types (15 approved categories)

Replace the current 8 active categories with the approved set:

`pothole`, `footpath_damage`, `garbage`, `dead_animal`, `streetlight`,
`power_outage`, `water_leakage`, `sewage_overflow`, `drain_blockage`,
`traffic_violation`, `illegal_parking`, `tree_fall`, `stray_animal`,
`encroachment`, `noise_pollution`

Migration strategy: old categories remap to new ones (`roads`→`pothole`
family handled by AI reclassification of open reports; existing historical
reports keep their type code, marked inactive in UI).

### 3.3 Routing rules

- One rule per category: condition `{category_in: [code]}` → **primary
  department** + `default_sla`.
- **Secondary routing is conditional**, not automatic: a report gets a
  secondary department only when the AI flags a secondary trigger (see §3.5)
  or a moderator/super admin adds one manually.
- Rules remain admin-editable in Super Admin portal (existing CRUD).

### 3.4 Data model (forward-compatible with Phase 2)

```
reports                          (existing, unchanged)
  department_id  → primary department only

report_assignments               (existing)
  + is_primary      bool default true
  + kind            enum: 'primary' | 'secondary'
  + linked_report_id nullable   ← Phase 2 master link (null in Phase 1)
  + dependency      enum: 'none' | 'blocked_by_primary' | 'parallel'
                    default 'none'  ← Phase 2 dependency order
```

Phase 1 behavior: a report may have **one open primary assignment and 0..n
open secondary assignments** (each secondary = own officer, own SLA countdown,
own queue entry in that department's portal). Primary department owns the
report status; secondary tasks do not block primary resolution but primary
cannot move to `closed` while secondary tasks are open (coordinated closure,
simplified version).

Existing single-status workflow stays intact — no workflow engine rewrite in Phase 1.

### 3.5 AI categorization update

- Vision/text prompt returns:
  - `category` (1 of 15 codes) + confidence
  - `primary_suggestion` (department code) — advisory; rule engine has final say
  - `secondary_triggers[]` — from approved matrix:
    - `traffic_obstruction` → BTP
    - `road_damage_by_utility_work` → BBMP_ENG (when BWSSB/BESCOM primary)
    - `sewage_in_drain` → BBMP_SWD
    - `cable_hazard` → BESCOM
    - etc. (8 approved scenarios)
  - `emergency_flag` bool + reason (display helpline; no auto-dispatch in Phase 1)
- Low confidence → moderator review (existing path), no blind auto-assign.
- Mapping table + keyword list live in the prompt config (admin-editable),
  versioned per decision (`source_rule_version` stored on report meta).

### 3.6 Access control (department isolation)

- Fix current leak: staff report search scoped to the caller's departments
  (membership via existing `department_users` pivot).
- Operations portal: department switcher when user belongs to >1 department
  (replaces the current `departments()->first()` heuristic).
- Roles unchanged (`department_officer`, `department_admin`, `moderator`,
  `super_admin`); `department_admin` manages users inside own department only
  (already enforced), plus can view own department's secondary tasks.

### 3.7 Super Admin views

- All-reports table with filters: **department, status, category, date range,
  officer** (existing admin portal; new page + backend endpoint).
- Multi-department complaints flagged (badge: "2 departments").
- Existing reassign endpoint extended to add/remove secondary tasks.

### 3.8 Citizen experience (unchanged flow)

Citizen sees one complaint, one tracking number, consolidated status. Internal
task split is hidden (mirrors Excel `citizen_visibility` rule).

---

## 4. Phase 2 Scope (future — after Phase 1 stabilizes)

1. Master ticket / child task formalization with dependency graph
   (`blocked-by`, sequential ordering, e.g. utility repair → road restoration).
2. Emergency triage pipeline: phrase-based detection → 101/112/1912 guidance
   shown/called before routine routing (needs policy sign-off, open item O4).
3. Asset-owner resolution: road/lake/pole ownership registry integration;
   owner overrides category (needs govt asset data, open items O2–O3).
4. Corp/ward derivation from GIS boundaries once official boundary data procured.
5. Official SLA + escalation matrix per category once agencies provide it.

---

## 5. Effort Estimate (Phase 1)

| Workstream | Estimate |
|---|---|
| Dept + category seeders & migration | 1–2 days |
| Assignment schema extension + migration | 1 day |
| Routing engine secondary support + rule CRUD update | 2–3 days |
| AI prompt update (15 categories, secondary triggers, emergency flag) | 2 days |
| Access control fixes + department switcher | 2 days |
| Super Admin filters page + endpoint | 2 days |
| Operations portal secondary-task queue + coordinated closure | 2–3 days |
| Tests (routing matrix acceptance suite from Excel T001–T020) | 2 days |
| **Total** | **~2.5 weeks (single dev)** |

---

## 6. Open Decisions / Risks (need governance answers)

| ID | Item | Impact |
|---|---|---|
| O1 | Official SLA & escalation matrix per department/category | Provisional SLAs used until then |
| O2 | Asset ownership data (roads, lakes, poles) from agencies | Phase 2 blocker; Phase 1 uses category routing only |
| O3 | Ward/corporation GIS boundaries | Phase 2 blocker |
| O4 | Emergency dispatch policy (when to show/call 101/112/1912) | Phase 2 blocker; Phase 1 shows helpline only |
| O5 | Master-complaint closure authority (primary dept vs Super Admin) | Decided: Phase 1 = Super Admin closes multi-dept; primary dept closes single-dept |
| O6 | Department user hierarchy (zone/division/officer levels) | Phase 1 uses flat officer/admin per department |
| O7 | Government sign-off on routing taxonomy | Workbook states it is research, not a statutory order — agencies must validate before production |

---

## 7. Recommendation Recap (for CTO discussion)

1. **Adopt the approved 15-category → department mapping now** (already
   documented and sourced from official BBMP/Sahaaya, BWSSB, BESCOM, BTP pages).
2. **Phase 1 = primary + conditional secondary model** on an assignment schema
   already shaped for Phase 2's master/child tasks.
3. **Asset-owner-first routing is the correct end-state** (Excel finding:
   "category must not override a verified owner"), but is deferred to Phase 2
   because the ownership datasets don't exist yet (Validation Gap register).
4. **Emergency handling stays advisory in Phase 1** (show helpline, flag for
   moderator) — no automated dispatch until policy O4 is signed off.
5. Everything remains config-driven so agencies/Government can adjust mappings
   without code changes, satisfying O7's versioning requirement.
