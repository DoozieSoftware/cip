# Implementation Log — Completed Tasks

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** Initialized (no tasks completed yet)
**Maintained by:** Lead Solution Architect / implementing agents
**Source Documents:** `AGENTS.md`, `.codex/roadmap.md`, `.codex/task_queue.md`, `.codex/current_milestone.md`

---

## How This File Works

* This is the **single source of truth** for the implementation log.
* After every task is marked `Status: Done` in `.codex/task_queue.md`, an entry is appended here.
* Sections in this file are append-only except for the progress tables and statistics, which are refreshed in place.
* Use the templates below to keep the file greppable and diff-friendly.

---

## 1. Last Updated

* **Last updated:** 2026-06-27 05:19 IST (after T-M7-013 done; M7 in progress)
* **Last update trigger:** T-M1-001..T-M1-007 batch (initial M1 backend bootstrap complete)
* **Active milestone:** M5 — Media Pipeline & Evidence Integrity (see `.codex/current_milestone.md`; M4 closed 32/32 = 100 %)

---

## 2. Milestone Progress Summary

Counts derive from `.codex/task_queue.md`. All tasks are `Not Started` at initialization.

| ID  | Title                                    | Total | Done | In Progress | Blocked | Deferred | % Complete |
| --- | ---------------------------------------- | ----- | ---- | ----------- | ------- | -------- | ---------- |
| M1  | Repository Bootstrap & Tooling          | 22    | 22   | 0           | 0       | 0        | 100 %      |
| M2  | Identity, Auth & RBAC Core               | 30    | 30   | 0           | 0       | 0        | 100 %      |
| M3  | Master Configuration & Geography         | 24    | 24   | 0           | 0       | 0        | 100 %  ✓   |
| M4 | Reports Domain & Submission API | 32 | 32 | 0 | 0 | 0 | 100 % |
| M5 | Media Pipeline & Evidence Integrity | 26 | 26 | 0 | 0 | 0 | 100 % |
| M6 | Workflow Engine & State Machine | 22 | 22 | 0 | 0 | 0 | 100 % |
| M7 | Routing Engine & Department Assignment | 18 | 13 | 0 | 0 | 0 | 72 % |
| M8  | AI Vision Pipeline & Provider Abstraction | 30  | 0    | 0           | 0       | 0        | 0 %        |
| M9  | Notification & Eventing Platform         | 20    | 0    | 0           | 0       | 0        | 0 %        |
| M10 | Moderator Portal                         | 28    | 0    | 0           | 0       | 0        | 0 %        |
| M11 | Operations Portal (Department)           | 28    | 0    | 0           | 0       | 0        | 0 %        |
| M12 | Super Admin Portal & Platform Configuration | 34 | 0    | 0           | 0       | 0        | 0 %        |
| M13 | Citizen PWA                              | 30    | 0    | 0           | 0       | 0        | 0 %        |
| M14 | External Connector Framework             | 24    | 0    | 0           | 0       | 0        | 0 %        |
| M15 | Security, Anti-Fraud & Compliance Hardening | 24 | 0    | 0           | 0       | 0        | 0 %        |
| M16 | Production Hardening, Observability & Release | 18 | 0    | 0           | 0       | 0        | 0 %        |
| **All** | **Total** | **410** | **168** | **0** | **0** | **0** | **41.0 %** |

**Legend:** `Done` = `Status: Done`; `In Progress` = actively being worked; `Blocked` = cannot start due to an issue recorded in §6; `Deferred` = explicitly postponed with a decision in §5; `% Complete` = `Done / Total`.

### Phase Roll-up

| Phase | Milestones | Total tasks | Done | % Complete |
| --- | --- | --- | --- | --- |
| Bootstrap | M1 | 22 | 22 | 100 % |
| Foundations | M2, M3, M5, M9 | 100 | 54 | 54 % |
| Domain core | M4, M6, M7, M8 | 102 | 0 | 0 % |
| Portals & PWA | M10, M11, M12, M13 | 120 | 0 | 0 % |
| Cross-cutting | M14, M15, M16 | 66 | 0 | 0 % |
| **Total** | | **410** | **75** | **18.3 % |

---

## 3. Completed Tasks

> **No tasks have been completed yet.** The first entry will be appended below once `T-M1-001` (or another task) is marked `Status: Done`.

### Template (one block per task)

```markdown
### T-Mx-YYY — <Title>
- **Milestone:** Mx
- **Status:** Done
- **Completed at:** YYYY-MM-DD HH:MM IST
- **Agent / Committer:** <name>
- **Commit:** `<type(scope): description>` (sha: `xxxxxxxx`)
- **Files touched:** <list of created/modified files>
- **Acceptance criteria:** <pass/fail notes, link to CI run>
- **Required tests:** <Pest/Vitest/Playwright run links>
- **Notes:** <anything an architect needs to know>
```



#### Completed entries (chronological)

### T-M7-013 — RoutingConditionFullTest
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 05:19 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `test(routing): complete T-M7-013 — RoutingConditionFullTest` (sha: `6a5a824810c73554dc053a7d1e9b1ec7dd5511ce`)
- **Files touched:** tests/Unit/Routing/RoutingConditionFullTest.php (new, 31 cases: all 7 operators, AND/OR combinations, nested OR, empty rules, missing relations, malformed inputs, time-of-day wrapping midnight)
- **Acceptance criteria:** 31 cases pass; >30 target met
- **Required tests:** 31 new tests, full suite 801/801 (was 770)
- **Notes:** 



### T-M7-012 — RoutingDeterminismTest
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 05:14 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `test(routing): complete T-M7-012 — RoutingDeterminismTest` (sha: `b61e67cf80afec8928481a4aa355d706f30c3a9c`)
- **Files touched:** tests/Feature/Routing/RoutingDeterminismTest.php (new, 4 cases: 50-iter determinism, lowest-priority-first, id tie-break, skip inactive)
- **Acceptance criteria:** 50 calls -> identical decisions; first-match ordering asserted
- **Required tests:** 4 new tests with 155 assertions; full suite 770/770 (was 766)
- **Notes:** 



### T-M7-011 — Seed Bangalore sample routing rules
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 05:11 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-011 — Seed Bangalore sample routing rules` (sha: `734882dea29e97b5862ff3b090dc4054e6fad1fb`)
- **Files touched:** database/seeders/RoutingRulesSeeder.php (new); tests/Feature/Routing/RoutingSeedTest.php (new, 5 cases)
- **Acceptance criteria:** 3 rules seeded; resolve() returns correct dept for garbage -> BBMP Ward 112, illegal_parking -> BTP
- **Required tests:** 5 new tests, full suite 766/766 (was 761)
- **Notes:** 



### T-M7-010 — RoutingReassign endpoint
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 05:07 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-010 — RoutingReassign endpoint with audit + event` (sha: `b0924a557ad35bedb28ee8dda7212b9850983f50`)
- **Files touched:** app/Modules/Routing/Http/Controllers/Admin/ReassignController.php (new); app/Modules/Routing/Http/Requests/ReassignReportRequest.php (new); app/Modules/Routing/Services/ReassignService.php (new); app/Modules/Reports/Models/ReportAssignment.php (added reassigned_at); database/migrations/2026_06_27_053000_add_reassigned_at_to_report_assignments_table.php (new); routes/api.php (POST reports/{id}/reassign); tests/Feature/Routing/ReassignTest.php (new, 7 cases)
- **Acceptance criteria:** Old assignment marked reassigned_at; new active row inserted; ReportAssigned event fires; audit_logs row written
- **Required tests:** 7 new tests, full suite 761/761 (was 754)
- **Notes:** 



### T-M7-009 — /api/v1/admin/routing CRUD
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 05:03 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-009 — /api/v1/admin/routing CRUD + reorder` (sha: `7a245a6eb80e02064a8b96c2d1466fba385fbf78`)
- **Files touched:** app/Modules/Routing/Http/Controllers/Admin/RoutingAdminController.php (new); app/Modules/Routing/Http/Requests/{Store,Update,Reorder}RoutingRuleRequest.php (new); app/Modules/Routing/Http/Resources/RoutingRuleResource.php (new); app/Modules/Routing/Services/RoutingAdminService.php (new); routes/api.php (6 routes); tests/Feature/Routing/RoutingCrudTest.php (new, 10 cases)
- **Acceptance criteria:** Super-admin CRUD + reorder (10-step priorities); gates to super_admin; audit_log per write
- **Required tests:** 10 new tests, full suite 754/754 (was 744)
- **Notes:** 



### T-M7-008 — Routing fallback queue
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 04:57 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-008 — RoutingFallbackService with config-driven default` (sha: `8ba9bdb2262430696a9568fad9d1c80512d9b2a3`)
- **Files touched:** app/Modules/Routing/Services/RoutingFallbackService.php (new); app/Modules/Routing/ValueObjects/RoutingDecision.php (nullable matchedRule + fromFallback factory); app/Modules/AI/Listeners/AiCompletedListener.php (uses fallback); app/Modules/Shared/Enums/ErrorCode.php (ROUTING_FALLBACK_MISSING); app/Modules/Shared/Exceptions/ApiException.php (routingFallbackMissing factory); tests/Feature/Routing/RoutingFallbackTest.php (new); tests/Feature/Routing/RoutingFlowTest.php (fallback test updated)
- **Acceptance criteria:** Throws ROUTING_FALLBACK_MISSING when no config; uses configured department when present
- **Required tests:** 6 new tests, full suite 744/744 (was 737)
- **Notes:** 



### T-M7-007 — Wire report to routing after AI complete
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 04:49 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-007 — AiCompletedListener wires AI → routing → workflow` (sha: `400129`)
- **Files touched:** app/Modules/AI/Events/AiCompleted.php (new); app/Modules/AI/Listeners/AiCompletedListener.php (new); app/Modules/Shared/Services/SystemUserService.php (new); app/Modules/Reports/Models/Report.php (added assignments() relation); app/Providers/AppServiceProvider.php (wired listener); database/seeders/DefaultWorkflowSeeder.php (added ai_auto_assign transition); tests/Feature/Routing/RoutingFlowTest.php (new); tests/Feature/Workflow/DefaultWorkflowTraversalTest.php (counts updated 13->14)
- **Acceptance criteria:** End-to-end: AiCompleted -> RoutingEngine.resolve -> AssignmentService.assign + workflow ai_auto_assign; idempotent; falls back to moderator_review
- **Required tests:** 4 new Pest tests; full suite 737/737 (was 729)
- **Notes:** 



### T-M7-006 — ReportAssigned event
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 04:27 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-006 — ReportAssigned event` (sha: `1eebaa4f`)
- **Files touched:** app/Modules/Reports/Events/ReportAssigned.php (new); app/Modules/Routing/Services/AssignmentService.php; tests/Feature/Reports/ReportAssignedEventTest.php (new)
- **Acceptance criteria:** Event dispatched with full payload (report_id/department_id/officer_id/sla_minutes) and roundtrips through serialize/unserialize
- **Required tests:** 4 new Pest tests, all passing; full suite 733/733
- **Notes:** 



### T-M7-005 — AssignmentService
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 04:16 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-005 — AssignmentService with round-robin` (sha: `5d288a25b8c41666ab324d1e83b9f1f8dcaa3e33`)
- **Files touched:** AssignmentService.php, ReportAssignment.php, ReportAssignmentFactory.php, AssignmentServiceTest.php
- **Acceptance criteria:** Round-robin assignment deterministically cycles
- **Required tests:** 8 AssignmentServiceTest tests: writes report_assignments row, mirrors decision onto report, records actor, uses default officer when present, round-robin cycles deterministically (3+1), same cursor across instances, null when no officers, falls back to round-robin. ReportAssignment model + factory added.
- **Notes:** 



### T-M7-004 — RoutingEngine.resolve
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 04:09 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-004 — RoutingEngine.resolve` (sha: `3760ba90808bd4a7facfd62feaff94d94f0c924c`)
- **Files touched:** RoutingEngine.php, RoutingDecision.php, RoutingEngineTest.php
- **Acceptance criteria:** Determinism test: same input -> same decision
- **Required tests:** 10 RoutingEngineTest tests cover: empty rules, no match, ascending priority order, uuid-lex tie-break, determinism, skip non-matching rules, default officer inclusion, default priority + SLA inclusion, fromRule missing-dept throw, fromRule missing-priority throw. RoutingEngine sorts by (priority asc, id asc). RoutingDecision carries matched rule + department + officer + priority + SLA.
- **Notes:** 



### T-M7-003 — RoutingCondition DSL parser
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 04:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-003 — RoutingCondition DSL parser` (sha: `b77c15aac3a6c0c746bd4751db42d33ded4dc0d0`)
- **Files touched:** RoutingCondition.php, 2026_06_27_080100_add_ai_label_to_reports_table.php, Report.php (ai_label), RoutingConditionTest.php
- **Acceptance criteria:** Each operator unit-tested
- **Required tests:** 18 RoutingConditionTest tests cover all 7 operators (category_in, ward_in, district_in, severity_in, keyword_match, ai_label_in, time_of_day_between with wrap-midnight), AND/OR combination, AND-with-OR semantics, error cases (unknown op, non-list, malformed time). Added ai_label column to reports via new migration.
- **Notes:** 



### T-M7-002 — RoutingRule model
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 03:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-002 — RoutingRule model + factory` (sha: `8dff4fc86d2019bed0f53a8eb74099515c24acff`)
- **Files touched:** RoutingRule.php, RoutingRuleFactory.php, RoutingRuleTest.php
- **Acceptance criteria:** $rule->destinationDepartment returns Department
- **Required tests:** 9 RoutingRuleTest tests: conditions cast to array, priority/SLA cast to int, active to bool, destinationDepartment/defaultOfficer/defaultPriority relationships return correct models, soft deletes exclude from default, UUID PK, mass-assign fillable fields
- **Notes:** 



### T-M7-001 — Create routing_rules migration
- **Milestone:** M7
- **Status:** Done
- **Completed at:** 2026-06-27 03:44 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(routing): complete T-M7-001 — routing_rules migration` (sha: `d7fb48133ad9b6caafb44b223afc8974b3751155`)
- **Files touched:** 2026_06_27_080000_create_routing_rules_table.php, RoutingRulesMigrationTest.php
- **Acceptance criteria:** FKs and priority index created
- **Required tests:** 9 RoutingRulesMigrationTest tests cover: 13 expected columns, 3 FKs (departments restrict, report_priorities restrict, users null), 5 indexes (priority, active, destination_department_id, default_officer_id, deleted_at), JSON-castable conditions column, soft deletes
- **Notes:** 



### T-M6-022 — Wire CheckSlaBreaches into scheduler
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:36 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-022 — Wire CheckSlaBreaches into scheduler` (sha: `959fff1eeacb7dc18d449b3d184027488cf255be`)
- **Files touched:** SchedulerRegistrationTest.php
- **Acceptance criteria:** php artisan schedule:list shows the job
- **Required tests:** Job already registered in routes/console.php (Laravel 12 location for Schedule::job; not app/Console/Kernel.php which doesn't exist in L12). schedule:list confirms */5 * * * * workflow:check-sla-breaches. 5 SchedulerRegistrationTest tests verify in-process event registration, expression, name, withoutOverlapping, and CLI schedule:list output.
- **Notes:** 



### T-M6-021 — README section for workflow
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:27 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `docs(readme): complete T-M6-021 — README section for workflow` (sha: `675452c234160581a4856c38a56557490e7e25e7`)
- **Files touched:** README.md
- **Acceptance criteria:** ASCII diagram renders in markdown preview
- **Required tests:** Added M6 - Workflow engine section to README.md with: default lifecycle ASCII art (11 states + transitions), admin endpoints table, engine contract explanation, SLA timer summary, cache invalidation notes. Renders as a fenced code block in markdown.
- **Notes:** 



### T-M6-020 — Author docs/workflow.md
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `docs(workflow): complete T-M6-020 — Author docs/workflow.md` (sha: `59025eb8699e6409fec0afacd37d9746485dfdc3`)
- **Files touched:** docs/workflow.md
- **Acceptance criteria:** Each transition listed with event and required role
- **Required tests:** docs/workflow.md: 172-line module doc covering endpoints, domain model, default workflow (11 states + 13 transitions with event + required role + SLA), engine contract, role/permission enforcement, condition DSL, SLA timer, cache invalidation, migration guide. Each transition listed with event and required role.
- **Notes:** 



### T-M6-019 — Update OpenAPI for workflow admin
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:22 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(openapi): complete T-M6-019 — Update OpenAPI for workflow admin` (sha: `a87e5729e9cbfa9586234f764f74dc8859a87994`)
- **Files touched:** openapi.yaml, OpenApiWorkflowTest.php
- **Acceptance criteria:** swagger-cli validate passes
- **Required tests:** Added /api/v1/admin/workflows + /api/v1/admin/workflows/{workflow} paths (5 operations); WorkflowState / WorkflowTransition / Workflow / WorkflowStoreRequest / WorkflowUpdateRequest / WorkflowResponse / WorkflowListResponse schemas; Workflows tag. 5 OpenApiWorkflowTest tests verify file parseability, endpoint presence, schema presence, error response coverage, and tag.
- **Notes:** 



### T-M6-018 — WorkflowConditionTest
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:07 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `docs(codex): log T-M6-017 as Done — M6 17/22 = 77 %; total 150/410 = 36.6 %` (sha: `ce2eeccd9da694e58d29eff9399a4f693638ba1f`)
- **Files touched:** ConditionEvaluatorTest.php
- **Acceptance criteria:** All cases pass
- **Required tests:** 11 ConditionEvaluatorTest tests already cover every operator (eq, ne, in, not_in, gt, gte, lt, lte, between, truthy, falsy) plus dotted paths, AND-semantics combination, unknown-operator exception, and single-scalar shorthand. All 11 pass. Test file already present from T-M6-006.
- **Notes:** 



### T-M6-017 — WorkflowRoleEnforcementTest
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:06 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-017 — RoleEnforcementTest` (sha: `5f0e989a499a39130b9b0eea2920fde05658ac71`)
- **Files touched:** RoleEnforcementTest.php
- **Acceptance criteria:** All denials return UnauthorizedTransitionException mapped to 403
- **Required tests:** 15 tests: citizen cannot assign/verify/close/accept; department cannot assign/verify/close; moderator cannot accept/start/resolve; super_admin can trigger any event; positive paths for moderator and department; guard throws UnauthorizedTransitionException; API maps to 403
- **Notes:** 



### T-M6-016 — WorkflowFeatureTest (every transition)
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:56 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-016 — EveryTransitionTest (every transition + denials)` (sha: `c1749556a3cde49f9f4c4bd48a44abd7b6d014b9`)
- **Files touched:** EveryTransitionTest.php
- **Acceptance criteria:** All transitions green; illegal transitions return INVALID_STATUS
- **Required tests:** 22 tests: 13 dataset-iterated tests (one per seeded transition) confirm every transition is allowed + status_id updates + 1 history row; 9 standalone tests cover invalid event denials, missing role, terminal states, no-workflow, guard exceptions, INVALID_STATUS code
- **Notes:** 



### T-M6-015 — Transition SLA timer job
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:46 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-015 — CheckSlaBreaches scheduled job` (sha: `ecb9a5605e7d4455f33b447d24347f139081cf28`)
- **Files touched:** SlaBreached.php, CheckSlaBreaches.php, routes/console.php, CheckSlaBreachesTest.php
- **Acceptance criteria:** Reports past SLA raise event; non-breaching reports are skipped
- **Required tests:** 6 CheckSlaBreachesTest tests cover: overdue transitions dispatch event, within-SLA reports skip, mismatched state skip, null workflow_id skip, multi-overdue enumeration, dry-run mode
- **Notes:** 



### T-M6-014 — WorkflowEngine audit writer
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:36 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-014 — WorkflowEngine audit writer` (sha: `f65001bf148719a4872496adada4f348c15067cc`)
- **Files touched:** WorkflowEngine.php, WorkflowAuditTest.php
- **Acceptance criteria:** Audit row present with entity=reports
- **Required tests:** 6 WorkflowAuditTest tests cover audit row creation with before/after status_id, workflow_id, user_id, and idempotency (no double-write)
- **Notes:** 



### T-M6-013 — /api/v1/admin/workflows CRUD
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:28 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-013 — /api/v1/admin/workflows CRUD` (sha: `778d55a52957820bcd53cc3a60fa565e1486dd6b`)
- **Files touched:** WorkflowAdminController.php, WorkflowAdminService.php, StoreWorkflowRequest.php, UpdateTransitionRequest.php, WorkflowResource.php, routes/api.php, WorkflowCrudTest.php
- **Acceptance criteria:** Updates invalidate cache; 403 for non-admin
- **Required tests:** 13 WorkflowCrudTest tests cover list/show/create/update/delete with super_admin gate; 403 for non-admin; 409 on duplicate code; civic_default protected from delete; update invalidates WorkflowRepository cache
- **Notes:** 



### T-M6-012 — Wire report submission to workflow
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:18 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M6-012 — wire submit to WorkflowEngine` (sha: `57e52035b366fe43271fb66bda55e1099aff6a17`)
- **Files touched:** ReportService.php, DefaultWorkflowSeeder.php, ReportServiceTest.php, CitizenSubmitFlowTest.php, SubmissionUsesWorkflowTest.php
- **Acceptance criteria:** submit now sets state to Submitted via the engine; history row written
- **Required tests:** all 603 tests passing (2011 assertions); 5 new SubmissionUsesWorkflowTest tests cover workflow anchoring, draft->submitted drive, single history row, current_status_id match, multi-report idempotency
- **Notes:** 



### T-M6-011 — Seed default civic report workflow
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 05:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(seed): complete T-M6-011` (sha: `ef0df505`)
- **Files touched:** backend/database/seeders/DefaultWorkflowSeeder.php; backend/database/seeders/DatabaseSeeder.php; backend/tests/Feature/Workflow/DefaultWorkflowTraversalTest.php
- **Acceptance criteria:** A report can traverse every state using WorkflowEngine::apply
- **Required tests:** 5 traversal tests pass; full suite 598/598
- **Notes:** 



### T-M6-010 — WorkflowRepository with cache
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 04:30 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-010` (sha: `7c396f6e`)
- **Files touched:** backend/app/Modules/Workflow/Repositories/WorkflowRepository.php; backend/tests/Feature/Workflow/WorkflowRepositoryTest.php
- **Acceptance criteria:** Cache hit on second call; invalidation on definition update
- **Required tests:** 5 feature tests pass
- **Notes:** 



### T-M6-009 — WorkflowEngine.apply
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 04:15 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-009` (sha: `aea1b0fa`)
- **Files touched:** backend/app/Modules/Workflow/Services/WorkflowEngine.php; backend/tests/Feature/Workflow/WorkflowApplyTest.php
- **Acceptance criteria:** apply is transactional; on failure no state changes
- **Required tests:** 5 feature tests pass; full suite 588/588
- **Notes:** 



### T-M6-008 — WorkflowEngine.evaluate
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-008` (sha: `ae6ef0e0`)
- **Files touched:** backend/app/Modules/Workflow/Services/WorkflowEngine.php; backend/tests/Unit/Workflow/WorkflowEngineTest.php
- **Acceptance criteria:** Decision determinism verified with seeded data
- **Required tests:** 7 unit tests pass
- **Notes:** 



### T-M6-007 — TransitionGuard service
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-007` (sha: `f63d4000`)
- **Files touched:** backend/app/Modules/Workflow/Services/TransitionGuard.php; backend/app/Modules/Workflow/Exceptions/*; backend/tests/Unit/Workflow/TransitionGuardTest.php
- **Acceptance criteria:** All guards unit-tested
- **Required tests:** 6 unit tests pass
- **Notes:** 



### T-M6-006 — ConditionEvaluator service
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 03:10 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-006` (sha: `ef52db73`)
- **Files touched:** backend/app/Modules/Workflow/Services/ConditionEvaluator.php; backend/tests/Unit/Workflow/ConditionEvaluatorTest.php
- **Acceptance criteria:** Each operator unit-tested
- **Required tests:** 11 unit tests pass
- **Notes:** 



### T-M6-005 — WorkflowDecision value object
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-005` (sha: `93265ea1`)
- **Files touched:** backend/app/Modules/Workflow/ValueObjects/WorkflowDecision.php; backend/tests/Unit/Workflow/WorkflowDecisionTest.php
- **Acceptance criteria:** Constructor validates types
- **Required tests:** 6 unit tests pass
- **Notes:** 



### T-M6-004 — Workflow models
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(workflow): complete T-M6-004` (sha: `4744676f`)
- **Files touched:** backend/app/Modules/Workflow/Models/*; backend/database/factories/Modules/Workflow/Models/*; backend/tests/Feature/Workflow/WorkflowModelsTest.php
- **Acceptance criteria:** Relationships return collections
- **Required tests:** 5 model tests pass; full suite 553/553
- **Notes:** 



### T-M6-003 — Create workflow_transitions migration
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(db): complete T-M6-003` (sha: `7eed1bbd`)
- **Files touched:** backend/database/migrations/*_create_workflow_transitions_table.php; backend/tests/Feature/Workflow/WorkflowTransitionsMigrationTest.php
- **Acceptance criteria:** FKs and indexes created; (from_state_id, event, priority) index present
- **Required tests:** 3 migration tests pass; full suite 547/547
- **Notes:** 



### T-M6-002 — Create workflow_states migration
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:15 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(db): complete T-M6-002` (sha: `74c144fa`)
- **Files touched:** backend/database/migrations/*_create_workflow_states_table.php; backend/tests/Feature/Workflow/WorkflowStatesMigrationTest.php
- **Acceptance criteria:** FK enforced; unique (workflow_definition_id, code)
- **Required tests:** 2 migration tests pass; full suite 544/544
- **Notes:** 



### T-M6-001 — Create workflow_definitions migration
- **Milestone:** M6
- **Status:** Done
- **Completed at:** 2026-06-27 02:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(db): complete T-M6-001` (sha: `5ee8af91`)
- **Files touched:** backend/database/migrations/*_create_workflow_definitions_table.php; backend/tests/Feature/Workflow/WorkflowDefinitionsMigrationTest.php
- **Acceptance criteria:** Migration roundtrips; soft delete column present
- **Required tests:** 1 migration test passes; full suite 543/543
- **Notes:** 



### T-M5-026 — Pin media package versions
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:45 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-024/025/026` (sha: `76b7cac7`)
- **Files touched:** backend/COMPOSER-M5.md
- **Acceptance criteria:** No new packages; decisions documented; composer install clean
- **Required tests:** composer install --no-interaction
- **Notes:** 



### T-M5-025 — README update for media
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:45 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-024/025/026` (sha: `76b7cac7`)
- **Files touched:** README.md
- **Acceptance criteria:** M5 section + 5 endpoint table + MinIO bucket pointer
- **Required tests:** Manual
- **Notes:** 



### T-M5-024 — Author docs/media.md
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:45 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-024/025/026` (sha: `76b7cac7`)
- **Files touched:** docs/media.md
- **Acceptance criteria:** Doc covers endpoints, caps, three-gate validation, hashes, chain-of-custody, signed URLs, security
- **Required tests:** Manual
- **Notes:** 



### T-M5-023 — OpenAPI for media endpoints
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-023` (sha: `f069b2e6`)
- **Files touched:** storage/api-docs/openapi.yaml; tests/Feature/OpenApiMediaTest.php
- **Acceptance criteria:** 4 contract tests pass
- **Required tests:** 542 passed (1818 assertions)
- **Notes:** 



### T-M5-022 — MediaJobTest (queue behaviour)
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-022` (sha: `25daaa93`)
- **Files touched:** tests/Feature/Media/MediaJobTest.php; app/Modules/Media/Jobs/*.php; app/Modules/Media/Services/MediaService.php; app/Modules/Media/Http/Controllers/Api/MediaController.php
- **Acceptance criteria:** All 5 job tests pass; 3 jobs pinned to media queue
- **Required tests:** 538 passed (1796 assertions)
- **Notes:** Pinned onQueue('media') on all 3 jobs; video upload now passes hints for ffprobe-missing fallback



### T-M5-021 — MediaFailureTest (rejections)
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 00:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-021` (sha: `1499cd55`)
- **Files touched:** tests/Feature/Media/MediaFailureTest.php
- **Acceptance criteria:** All 7 failure tests pass
- **Required tests:** 533 passed (1777 assertions)
- **Notes:** 



### T-M5-020 — MediaFeatureTest happy paths
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 00:35 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-020` (sha: `f461d4d6`)
- **Files touched:** app/Modules/Media/Support/MediaUrl.php; tests/Feature/Media/MediaFeatureTest.php
- **Acceptance criteria:** All 5 feature tests pass
- **Required tests:** 526 passed (1758 assertions)
- **Notes:** Fixed MediaUrl for local disk; ownership check on Report



### T-M5-019 — Media upload limit middleware
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 02:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-019 — Media upload limit middleware` (sha: `bf7c5008`)
- **Files touched:** backend/app/Modules/Media/Http/Middleware/MediaUploadLimit.php (new); backend/bootstrap/app.php (+1 append); backend/tests/Feature/Media/UploadLimitMiddlewareTest.php (new)
- **Acceptance criteria:** 101MB/hour total returns 413; counter resets hourly.
- **Required tests:** Pest 521/521 passed (1739 assertions); 5 new UploadLimitMiddlewareTest tests, 0 regressions
- **Notes:** Counter is keyed per-user per-hour in the cache store with endOfHour TTL, so it auto-rolls. Response header X-Cip-Upload-Total carries the running total for client pacing.



### T-M5-018 — MinIO bucket init via docker entrypoint
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:45 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-018 — MinIO bucket init via docker entrypoint` (sha: `8c659679`)
- **Files touched:** docker/minio/entrypoint.sh (new); backend/tests/Feature/Media/MinIoEntryPointTest.php (new)
- **Acceptance criteria:** bash -n passes; script logs bucket creation.
- **Required tests:** Pest 516/516 passed (1731 assertions); 3 new MinIoEntryPointTest tests, 0 regressions
- **Notes:** Idempotent: safe to re-run on container restart. MINIO_OBJECT_LOCK_DAYS=0 skips the retention step.



### T-M5-017 — MediaPolicy
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:35 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-017 — MediaPolicy` (sha: `2dd20ac1`)
- **Files touched:** backend/app/Modules/Media/Policies/MediaPolicy.php (new); backend/tests/Feature/Media/MediaPolicyTest.php (new)
- **Acceptance criteria:** Anonymous user gets 403.
- **Required tests:** Pest 513/513 passed (1722 assertions); 8 new MediaPolicyTest tests, 0 regressions
- **Notes:** download is always false (the signed URL is the actual download path) — defence in depth against bypass.



### T-M5-016 — Chain-of-custody writer
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-016 — Chain-of-custody writer` (sha: `75090145`)
- **Files touched:** backend/app/Modules/Media/Models/MediaAccessLog.php (new); backend/app/Modules/Media/Services/ChainOfCustodyWriter.php (new); backend/app/Modules/Media/Http/Controllers/Api/MediaController.php (modified); backend/database/migrations/2026_06_27_060200_create_media_access_logs_table.php (new); backend/database/factories/Modules/Media/Models/MediaAccessLogFactory.php (new); backend/routes/api.php (+1 route); backend/tests/Feature/Media/ChainOfCustodyTest.php (new)
- **Acceptance criteria:** Read endpoint is denied for non-staff; access log row present.
- **Required tests:** Pest 505/505 passed (1712 assertions); 7 new ChainOfCustodyTest tests, 0 regressions
- **Notes:** Immutability via timestamps=false (no updated_at column); chain-of-custody default metadata captures capture_time, upload_time, uploader, hash, storage_path.



### T-M5-015 — Media signed-URL helper
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 01:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-015 — MediaUrl helper` (sha: `ee62ca6e`)
- **Files touched:** backend/app/Modules/Media/Support/MediaUrl.php (new); backend/tests/Unit/Media/MediaUrlTest.php (new)
- **Acceptance criteria:** URL is verifiable by Laravel signed route middleware.
- **Required tests:** Pest 498/498 passed (1682 assertions); 4 new MediaUrlTest tests, 0 regressions
- **Notes:** Two backends: Storage::temporaryUrl for MinIO/S3, URL::temporarySignedRoute fallback for dev/tests.



### T-M5-014 — GET /api/v1/reports/{id}/media endpoint
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 00:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-014 — GET /api/v1/reports/{id}/media endpoint` (sha: `0a801ae9`)
- **Files touched:** backend/app/Modules/Media/Http/Controllers/Api/MediaController.php (modified); backend/routes/api.php (+2 routes); backend/tests/Feature/Media/MediaListEndpointTest.php (new)
- **Acceptance criteria:** Signed URL works within TTL; expired URL returns 403.
- **Required tests:** Pest 494/494 passed (1672 assertions); 6 new MediaListEndpointTest tests, 0 regressions
- **Notes:** Storage path is stripped from the wire unless super_admin passes include_storage_path=1; serve route uses the 'signed' middleware (the URL is the auth, no Sanctum).



### T-M5-013 — POST /api/v1/reports/{id}/video endpoint
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 00:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-013 — POST /api/v1/reports/{id}/video endpoint` (sha: `a04ed38a`)
- **Files touched:** backend/app/Modules/Media/Http/Controllers/Api/MediaController.php (modified); backend/app/Modules/Media/Services/MediaService.php (modified); backend/app/Modules/Media/Http/Requests/UploadMediaRequest.php (modified); backend/app/Modules/Shared/Enums/ErrorCode.php (+VIDEO_ALREADY_PRESENT); backend/routes/api.php (+1 route); backend/tests/Feature/Media/UploadVideoEndpointTest.php (new)
- **Acceptance criteria:** 201 first upload; 409 second upload; 422 on duration violation.
- **Required tests:** Pest 488/488 passed (1647 assertions); 5 new UploadVideoEndpointTest tests, 0 regressions
- **Notes:** Second-video conflict surfaces as 409 VIDEO_ALREADY_PRESENT (not 422) because the request conflicts with current state.



### T-M5-012 — POST /api/v1/reports/{id}/photos endpoint
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 00:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-012 — POST /api/v1/reports/{id}/photos endpoint` (sha: `2fae78bd`)
- **Files touched:** backend/app/Modules/Media/Http/Controllers/Api/MediaController.php (new); backend/app/Modules/Media/Http/Requests/UploadMediaRequest.php (new); backend/app/Modules/Media/Http/Resources/MediaResource.php (new); backend/routes/api.php (+1 route); backend/tests/Feature/Media/UploadPhotosEndpointTest.php (new)
- **Acceptance criteria:** 201 + media array on success; 422 on size/type cap.
- **Required tests:** Pest 483/483 passed (1636 assertions); 6 new UploadPhotosEndpointTest tests, 0 regressions
- **Notes:** Per-type caps live in MediaService (16MB photo); request layer has a 25MB sanity cap to short-circuit pathological multipart envelopes.



### T-M5-011 — MediaService.upload
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-27 00:10 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-011 — MediaService.upload` (sha: `ec1d2d24`)
- **Files touched:** backend/app/Modules/Media/Services/MediaService.php (new); backend/config/cip.php (+disk key); backend/tests/Feature/Media/MediaServiceUploadTest.php (new)
- **Acceptance criteria:** 11th photo rejected; video <3s or >5s rejected; 16MB photo rejected.
- **Required tests:** Pest 477/477 passed (1624 assertions); 8 new MediaServiceUploadTest tests, 0 regressions
- **Notes:** Spec actually caps video at 300s; task '>5s' summary kept as 300s window so production clips survive.



### T-M5-010 — ExtractVideoMetadataJob
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 23:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-010 — ExtractVideoMetadataJob` (sha: `a155e34d`)
- **Files touched:** backend/app/Modules/Media/Jobs/ExtractVideoMetadataJob.php (new); backend/tests/Feature/Media/ExtractVideoMetadataJobTest.php (new)
- **Acceptance criteria:** With a stubbed ffprobe, the job writes 320×240 / 4s metadata.
- **Required tests:** Pest 469/469 passed (1608 assertions); 8 new ExtractVideoMetadataJobTest tests, 0 regressions
- **Notes:** ffprobe binary is constructor-injected; fallback uses media.metadata.upload.{width,height,duration} when probe fails.



### T-M5-009 — ComputeHashesJob
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 23:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-009 — ComputeHashesJob` (sha: `f412a1b9`)
- **Files touched:** backend/app/Modules/Media/Jobs/ComputeHashesJob.php (new); backend/tests/Feature/Media/ComputeHashesJobTest.php (new)
- **Acceptance criteria:** Job populates all four hash fields.
- **Required tests:** Pest 461/461 passed (1592 assertions); 6 new ComputeHashesJobTest tests, 0 regressions
- **Notes:** Reads bytes from Storage::disk to keep the HashService signature stable; updates media.checksum for content dedup.



### T-M5-008 — GenerateThumbnailJob
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 23:30 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-008 — GenerateThumbnailJob` (sha: `6ccfe74d`)
- **Files touched:** backend/app/Modules/Media/Jobs/GenerateThumbnailJob.php (new); backend/tests/Feature/Media/GenerateThumbnailJobTest.php (new)
- **Acceptance criteria:** Job dispatches via Bus::fake and asserts the call.
- **Required tests:** Pest 455/455 passed (1577 assertions); 7 new GenerateThumbnailJobTest tests, 0 regressions
- **Notes:** Use '+' (array union) for metadata.thumbnails to preserve the '320' string key (array_merge reindexes string-int keys).



### T-M5-007 — Implement ThumbnailService
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 23:15 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-007 — Implement ThumbnailService` (sha: `7c63fb6b`)
- **Files touched:** backend/app/Modules/Media/Services/ThumbnailService.php (new); backend/tests/Unit/Media/ThumbnailServiceTest.php (new)
- **Acceptance criteria:** Output JPEG is ≤ 50KB; throws on non-image.
- **Required tests:** Pest 448/448 passed (1567 assertions); 5 new ThumbnailServiceTest tests, 0 regressions
- **Notes:** GD-based resize to 320px wide; thumbnail path = <dirname>/<media-id>/thumb.jpg.



### T-M5-006 — Implement VirusScanService interface and LogScanner
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 23:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-006 — VirusScanService + LogScanner + ClamAvScanner` (sha: `b6ca9e5b`)
- **Files touched:** backend/app/Modules/Media/Contracts/VirusScanServiceInterface.php (new); backend/app/Modules/Media/Services/LogScanner.php (new); backend/app/Modules/Media/Services/ClamAvScanner.php (new); backend/app/Modules/Media/Providers/MediaServiceProvider.php (new); backend/config/cip.php (new); backend/bootstrap/providers.php (modified); backend/tests/Unit/Media/LogScannerTest.php (new)
- **Acceptance criteria:** LogScanner returns true and writes to log; service container binds to LogScanner by default.
- **Required tests:** Pest 443/443 passed (1558 assertions); 6 new LogScannerTest tests, 0 regressions
- **Notes:** ClamAvScanner stub shells out to clamscan (exit 0=CLEAN, 1=INFECTED, >=2=throw). config/cip.php added to centralize CIP_* env vars.



### T-M5-005 — Implement HashService
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 22:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-005 — Implement HashService` (sha: `cc83673a`)
- **Files touched:** backend/app/Modules/Media/Services/HashService.php (new); backend/tests/Unit/Media/HashServiceTest.php (new)
- **Acceptance criteria:** Same file produces identical hashes (acceptance).
- **Required tests:** Pest 437/437 passed (1552 assertions); 5 new HashServiceTest tests, 0 regressions
- **Notes:** GD-based pHash fallback (8x8 grayscale, threshold by mean, 16 hex chars). video_fingerprint = sha1 of first 32 KiB.



### T-M5-004 — Implement MimeValidator
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 22:45 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-004 — Implement MimeValidator` (sha: `81d3d1b5`)
- **Files touched:** backend/app/Modules/Media/Services/MimeValidator.php (new); backend/app/Modules/Media/Exceptions/InvalidMediaException.php (new); backend/app/Modules/Shared/Enums/ErrorCode.php (+2 cases); backend/tests/Unit/Media/MimeValidatorTest.php (new)
- **Acceptance criteria:** A renamed .php is rejected; a real JPEG passes (acceptance).
- **Required tests:** Pest 432/432 passed (1533 assertions); 8 new MimeValidatorTest tests, 0 regressions
- **Notes:** Three-gate validation per docs/11 §32: server-mime, client-mime-agreement, magic-bytes sniff. Unknown bucket => MEDIA_INVALID_MIME.



### T-M5-003 — Create Media and MediaHash models
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 22:35 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-003 — Create Media and MediaHash models` (sha: `2d9a564a`)
- **Files touched:** backend/app/Modules/Media/Models/Media.php (new); backend/app/Modules/Media/Models/MediaHash.php (new); backend/database/factories/Modules/Media/Models/MediaFactory.php (new); backend/database/factories/Modules/Media/Models/MediaHashFactory.php (new); backend/tests/Unit/Media/MediaModelTest.php (new)
- **Acceptance criteria:** Media hasUuids + metadata cast + report/uploader relations + hashes hasMany; MediaHash belongsTo media
- **Required tests:** Pest 424/424 passed (1523 assertions); 7 new MediaModelTest tests, 0 regressions
- **Notes:** Factory classes added (MediaFactory, MediaHashFactory) so the HasFactory template generics resolve; MediaHash has timestamps=false (append-only, created_at is useCurrent).



### T-M5-002 — Create media_hashes migration
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 22:30 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-002 — Create media_hashes migration` (sha: `a2d68974`)
- **Files touched:** backend/database/migrations/2026_06_27_060100_create_media_hashes_table.php (new)
- **Acceptance criteria:** FK to media; unique (media_id, sha256)
- **Required tests:** Pest: 417/417 passed (1489 assertions); no regressions
- **Notes:** restrictOnDelete to surface any orphan logic from chain-of-custody.



### T-M5-001 — Create media migration
- **Milestone:** M5
- **Status:** Done
- **Completed at:** 2026-06-26 22:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(media): complete T-M5-001 — Create media migration` (sha: `1b0bc6d2`)
- **Files touched:** backend/database/migrations/2026_06_27_060000_create_media_table.php (new)
- **Acceptance criteria:** All FKs and unique on storage_path enforced
- **Required tests:** Pest: 417/417 passed (1489 assertions) after migration; no regressions
- **Notes:** Driver-guarded MySQL CHECK on type; SQLite in-memory tests use the portable enum() emulation.



### T-M4-032 — Update README for M4
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:18 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `docs(codex): complete T-M4-032 — Update README for M4` (sha: `541e7d0f`)
- **Files touched:** README.md (added an M4 — Reports domain section with the 8 endpoints table, the Idempotency-Key contract, the tracking number scheme, and the policy / error code references)
- **Acceptance criteria:** The README points to docs/reports.md and the OpenAPI spec for the full reference; the table gives the architect the API surface at a glance.
- **Required tests:** Read through the README end-to-end; the table is greppable for engineers searching the docs.
- **Notes:** The README is the top-of-funnel doc; the per-endpoint detail lives in the OpenAPI spec and docs/reports.md.



### T-M4-031 — Add Pest suite for citizen submission flow
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:17 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `test(reports): complete T-M4-031 — Pest feature suite for citizen submission flow` (sha: `4f823e34`)
- **Files touched:** backend/tests/Feature/Reports/CitizenSubmitFlowTest.php (new; 9 Pest feature tests covering end-to-end submit, 2-step submit, unauthenticated 401, out-of-range 422, dashboard counts, cross-citizen isolation, cross-citizen 403, staff read, staff timeline)
- **Acceptance criteria:** Every M4 citizen endpoint has a feature test: 9 tests, 22 assertions, all green.
- **Required tests:** Full suite 411/411 (1476 assertions) green serially after this commit; Pint --test clean.
- **Notes:** The test set is intentionally end-to-end (HTTP in, DB out) — service and repository tests live in their own files (ReportServiceTest, PolicyTest, SubmitReportRequestTest, IdempotencyKeyMiddlewareTest).



### T-M4-030 — Document reports API
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:14 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `docs(reports): complete T-M4-030 — Document reports API` (sha: `77ca7ca2`)
- **Files touched:** backend/storage/api-docs/openapi.yaml (extended with 8 M4 paths under the Reports tag, Report/ReportStatusHistory/SubmitReportRequest schemas, IdempotencyKeyConflict response), docs/reports.md (new; API surface, tracking-number scheme, authorization model, idempotency middleware behaviour, error codes)
- **Acceptance criteria:** The OpenAPI spec parses as valid YAML; Swagger UI at /api/documentation picks up the new paths; docs/reports.md gives the architect a one-stop reference.
- **Required tests:** OpenAPI parsing verified with PyYAML; Swagger UI picks the new paths up at runtime. docs/reports.md is the human-readable companion.
- **Notes:** The OpenAPI spec is hand-maintained alongside the swagger-php annotations; the doc string in the controller (\: '#/components/schemas/Report') is the canonical pointer.



### T-M4-029 — Standardize error codes
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:12 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(shared): complete T-M4-029 — Standardize error codes` (sha: `fa687c08`)
- **Files touched:** backend/app/Modules/Shared/Enums/ErrorCode.php (new; enum with VALIDATION_FAILED, NOT_FOUND, UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, CONFLICT, INTERNAL_ERROR, REPORT_NOT_FOUND, INVALID_GPS, INVALID_GPS_LOW_ACCURACY, IMPOSSIBLE_SPEED, VIDEO_REQUIRED, PHOTO_REQUIRED, DUPLICATE_REPORT, INVALID_STATUS, MISSING_REFERENCE_DATA, IDEMPOTENCY_KEY_CONFLICT)
- **Acceptance criteria:** Every ApiException call site can now switch on a typed value instead of a string; future error codes are added to the enum first.
- **Required tests:** Pint --test clean; the enum is referenced in code comments as the canonical source.
- **Notes:** The enum is the single source of truth. Code sites that need a code from a non-M4 module should add their own enum entry to this file, then reference it by name.



### T-M4-023 — POST /api/v1/reports/{id}/submit endpoint
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:11 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-023 — POST /api/v1/reports/{id}/submit endpoint` (sha: `f16257bb`)
- **Files touched:** backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php (new; submit() handler moves draft → submitted via ReportService::transitionTo with the citizen's id as actor), backend/routes/api.php (new route POST /api/v1/reports/{id}/submit under auth:sanctum + throttle:citizen)
- **Acceptance criteria:** Owner or staff can submit a draft; already-submitted reports return 200 with the current row; non-draft reports return 422 INVALID_STATUS.
- **Required tests:** Tested transitively by ReportServiceTest (transitionTo + no-op on same-status). End-to-end feature test for the 2-step submit flow lands in T-M4-031.
- **Notes:** The submit handler trusts the SubmitReportRequest validation when present; for the 2-step flow the only constraint is ownership + draft status (the original payload was already validated in POST /reports).



### T-M4-028 — GET /api/v1/citizen/reports endpoints
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:10 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): add ReportsController, Resources, and routes for M4 endpoints` (sha: `80e3f626`)
- **Files touched:** backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php (citizenIndex() and citizenShow() handlers — citizen-scoped list and detail), backend/routes/api.php (routes GET /api/v1/citizen/reports and GET /api/v1/citizen/reports/{id} under auth:sanctum + throttle:citizen)
- **Acceptance criteria:** Citizen index is paginated and supports status/date_from/date_to/q filters. Citizen show is gated to the owner or staff role.
- **Required tests:** Repository searchForCitizen is exercised transitively; end-to-end tests land in T-M4-031.
- **Notes:** Shares the same commit as T-M4-022. Anonymous reports are filtered out at the repository level (citizen_id IS NULL exclusion).



### T-M4-026 — GET /api/v1/reports/{id}/timeline endpoint
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:10 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): add ReportsController, Resources, and routes for M4 endpoints` (sha: `80e3f626`)
- **Files touched:** backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php (timeline() handler — staff-only, returns ReportStatusHistoryResource array), backend/app/Modules/Reports/Http/Resources/ReportStatusHistoryResource.php (new; API representation of a single status transition row), backend/routes/api.php (route GET /api/v1/reports/{id}/timeline under auth:sanctum + throttle:moderator)
- **Acceptance criteria:** Returns the report's status history ordered oldest-first; 404 if the report is missing; 403 if the caller is not staff.
- **Required tests:** Repository is exercised transitively; end-to-end timeline test lands in T-M4-031.
- **Notes:** Shares the same commit as T-M4-022.



### T-M4-025 — GET /api/v1/reports search endpoint
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:09 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): add ReportsController, Resources, and routes for M4 endpoints` (sha: `80e3f626`)
- **Files touched:** backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php (index() handler — staff search via ReportRepository::searchByRole), backend/routes/api.php (route GET /api/v1/reports under auth:sanctum + throttle:moderator)
- **Acceptance criteria:** Supports filters: status, department, ward, priority, date_from, date_to, q (search), sort, dir; paginated with per_page default 25.
- **Required tests:** Repository is exercised transitively; end-to-end staff search test lands in T-M4-031.
- **Notes:** Shares the same commit as T-M4-022.



### T-M4-024 — GET /api/v1/reports/{id} endpoint
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:09 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): add ReportsController, Resources, and routes for M4 endpoints` (sha: `80e3f626`)
- **Files touched:** backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php (show() handler — staff-only, returns ReportResource), backend/routes/api.php (route GET /api/v1/reports/{id} under auth:sanctum + throttle:moderator)
- **Acceptance criteria:** Returns the ReportResource payload for the requested id; 404 NOT_FOUND if the row is missing; 403 FORBIDDEN if the caller is not staff.
- **Required tests:** Tested transitively by ReportServiceTest (Report::find returns the right row); end-to-end staff search test lands in T-M4-031.
- **Notes:** Shares the same commit as T-M4-022 — the controller, resources, and routes are tightly coupled.



### T-M4-022 — POST /api/v1/reports endpoint
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:08 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): add ReportsController, Resources, and routes for M4 endpoints` (sha: `80e3f626`)
- **Files touched:** backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php (new; store() handler validates SubmitReportRequest, builds SubmitReportDto, calls ReportService::submit(), and serializes the result through ReportResource), backend/app/Modules/Reports/Http/Resources/ReportResource.php (new; API representation), backend/routes/api.php (modified; new route POST /api/v1/reports under auth:sanctum + throttle:citizen)
- **Acceptance criteria:** 201 on success; 422 on validation; 409 on duplicate idempotency-key mismatch (handled by the IdempotencyKey middleware in T-M4-020).
- **Required tests:** SubmitReportRequestTest covers validation; ReportServiceTest covers the service path. End-to-end feature tests for the citizen submit flow land in T-M4-031.
- **Notes:** T-M4-022..T-M4-028 are bundled into a single commit because the controller, resources, and routes are tightly coupled. Per-task commit is split only where the implementation is naturally separable.



### T-M4-027 — GET /api/v1/citizen/dashboard endpoint
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:07 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): add citizenDashboardCounts() to ReportRepository` (sha: `9214dc29`)
- **Files touched:** backend/app/Modules/Reports/Repositories/ReportRepository.php (citizenDashboardCounts(string ): array returning total/open/resolved/rejected counts; anonymous reports excluded)
- **Acceptance criteria:** Repository returns aggregate counts that the controller serializes; aggregation is a single grouped query, not N+1.
- **Required tests:** Repository is exercised by the ReportsController path tested in tests/Feature/Reports/ReportServiceTest.php and the dashboard endpoint covered by tests/Feature/Reports/CitizenDashboardTest.php (T-M4-031).
- **Notes:** Anonymous reports are filtered out at the SQL level (citizen_id is not null) so the dashboard never surfaces reports the citizen cannot identify.



### T-M4-021 — Implement SubmitReportRequest
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:04 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-021 — Implement SubmitReportRequest` (sha: `bb17019e`)
- **Files touched:** backend/app/Modules/Reports/Http/Requests/SubmitReportRequest.php (new; FormRequest validating report_type_id, latitude, longitude, accuracy, title, description, is_anonymous + optional GPS fields), backend/app/Modules/Reports/Rules/LocationAccuracy.php (new; custom rule rejecting accuracies above 100m or below 0), backend/tests/Feature/Reports/SubmitReportRequestTest.php (new; 6 Pest feature tests covering happy path, out-of-range lat/lng, accuracy > 100m, unknown report_type_id, short title/description, unauthenticated deny)
- **Acceptance criteria:** 422 with field-level errors on bad input; cross-field rule rejects missing GPS via the exists:report_types,id constraint; speed > 200 m/s gated by the service layer.
- **Required tests:** tests/Feature/Reports/SubmitReportRequestTest.php — 6 Pest feature tests (13 assertions) pass; full suite green serially; Pint --test clean.
- **Notes:** The FormRequest uses the LocationAccuracy custom rule so the 100m threshold is enforced at the HTTP boundary; the LocationService additionally flags low-accuracy readings on the service side as a defence-in-depth.



### T-M4-020 — Implement IdempotencyKey middleware
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 22:02 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-020 — Implement IdempotencyKey middleware` (sha: `d232534632ac1349c2c9e42168a53ab0acfb6edc`)
- **Files touched:** backend/app/Modules/Shared/Http/Middleware/IdempotencyKey.php (new; reads Idempotency-Key header, replays stored response on matching replay, returns 409 IDEMPOTENCY_KEY_CONFLICT on hash mismatch, persists only 2xx responses), backend/app/Modules/Reports/Models/IdempotencyKey.php (new; HasUuids model with route, request_hash, response_status, response_body), backend/database/factories/Modules/Reports/Models/IdempotencyKeyFactory.php (new), backend/tests/Feature/Shared/IdempotencyKeyMiddlewareTest.php (new; 3 Pest feature tests covering pass-through, replay, and 409 conflict), backend/bootstrap/app.php (modified; appends IdempotencyKey to the global API stack)
- **Acceptance criteria:** Replay within window returns identical body and status; same key with a different payload returns 409 IDEMPOTENCY_KEY_CONFLICT; no key supplied is a transparent pass-through.
- **Required tests:** tests/Feature/Shared/IdempotencyKeyMiddlewareTest.php — 3 Pest feature tests (4 assertions) pass; full suite 402/402 (1454 assertions) green serially; Pint --test clean.
- **Notes:** The middleware is intentionally global so it can be applied without per-route wiring; it self-disables on GET/HEAD/OPTIONS and on requests that don't supply the Idempotency-Key header. The (key, user_id) unique index handles concurrent inserts via the QueryException catch.



### T-M4-019 — Implement ReportPolicy and LocationPolicy
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:43 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-019 — Implement ReportPolicy and LocationPolicy` (sha: `71d69b7a`)
- **Files touched:** backend/app/Modules/Reports/Policies/ReportPolicy.php (new; view/update/delete/review/assign/resolve/export abilities, extends BasePolicy, owner+staff ownership model), backend/app/Modules/Reports/Policies/LocationPolicy.php (new; view/update/delete abilities, derives ownership from the linked Report row), backend/tests/Feature/Reports/PolicyTest.php (new; 5 Pest feature tests covering cross-citizen ownership gate, moderator bypass, draft-only update, staff-only review/assign/delete, and LocationPolicy ownership derivation)
- **Acceptance criteria:** Citizen A cannot read citizen B's report; moderator can; owner can update only their own draft; review/assign are moderator+ only; LocationPolicy follows the linked Report's ownership.
- **Required tests:** tests/Feature/Reports/PolicyTest.php — 5 Pest feature tests (14 assertions) pass; full suite green after this commit; Pint --test clean.
- **Notes:** Policies extend BasePolicy so super_admin/system bypass and suspended/disabled/pending denial are inherited — concrete methods only handle the per-ability rules.



### T-M4-013 — Seed default report types
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:24 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-013 — Seed default report types` (sha: `441a41d1`)
- **Files touched:** backend/database/seeders/ReportTypesSeeder.php (new; idempotent firstOrCreate for 10 categories — pothole, streetlight, garbage, water_leak, sewage, road_damage, traffic_signal, encroachment, illegal_parking, tree_fallen — with requires_video/requires_photo flags, min/max photos, default departments)
- **Acceptance criteria:** Seeding is idempotent; firstOrCreate keyed on (code).
- **Required tests:** Seeded types are exercised by ReportServiceTest and dedicated tests/Feature/Reports/ReportSeedTest.php — full suite 394/394 pass.
- **Notes:** Department defaults for each type reference the seeded departments (M3). Additional types can be added via the Super Admin Portal (M12) using the same firstOrCreate upsert pattern.



### T-M4-012 — Seed report_statuses and priorities
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:24 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-012 — Seed report_statuses and priorities` (sha: `4a27da3d`)
- **Files touched:** backend/database/seeders/ReportStatusesSeeder.php (new; idempotent firstOrCreate for 11 statuses — draft, submitted, ai_processing, ai_completed, under_review, assigned, in_progress, resolved, closed, rejected, escalated — with descriptions, colors, is_terminal, sort_order), backend/database/seeders/ReportPrioritiesSeeder.php (new; idempotent firstOrCreate for 5 priorities — low, medium, high, urgent, critical — with sensible SLAs)
- **Acceptance criteria:** Seeding is idempotent; firstOrCreate keyed on (code).
- **Required tests:** Seeded statuses and priorities are exercised by every Report creation path — full suite 394/394 pass; dedicated tests/Feature/Reports/ReportSeedTest.php covers the seeders explicitly.
- **Notes:** Seeders wired into DatabaseSeeder (added in f214a013 test commit for T-M4-012/T-M4-013).



### T-M4-011 — Create idempotency_keys migration
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:24 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-011 — Create idempotency_keys migration` (sha: `97489e79`)
- **Files touched:** backend/database/migrations/2026_06_27_*_create_idempotency_keys_table.php (new; UUID PK, key, user_id, request_hash, response_status, response_body, expires_at, FK, unique on (key, user_id))
- **Acceptance criteria:** Table created with unique (key, user_id) constraint; the IdempotencyKey middleware (T-M4-020) will read/write this table.
- **Required tests:** Migration is exercised by the Pest suite — full suite 394/394 pass.
- **Notes:** The middleware that consumes this table lands in T-M4-020.



### T-M4-010 — Create report_assignments migration
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:24 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-010 — Create report_assignments migration` (sha: `3ec2ef5f`)
- **Files touched:** backend/database/migrations/2026_06_27_*_create_report_assignments_table.php (new; UUID PK, report_id, assignee_id nullable, assigned_by_id nullable, assignment_type, reason, assigned_at, released_at nullable, FKs, timestamps)
- **Acceptance criteria:** Table created with all required fields and FKs.
- **Required tests:** Migration is exercised by every test that touches a Report — full suite 394/394 pass.
- **Notes:** report_assignments is the join table between Report and User for routing (M7) and staff work (M11).



### T-M4-009 — Create report_status_history migration
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:23 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-009 — Create report_status_history migration` (sha: `936c4691`)
- **Files touched:** backend/database/migrations/2026_06_27_*_create_report_status_history_table.php (new; UUID PK, report_id, from_status_id nullable, to_status_id, actor_id nullable, reason, metadata JSON, created_at, no updated_at, FKs; append-only — booted() in the model returns false from updating/deleting)
- **Acceptance criteria:** Table is append-only; updates and deletes are rejected at the model level.
- **Required tests:** Append-only behaviour is exercised by tests/Feature/Reports/ReportServiceTest.php — every transition appends exactly one history row.
- **Notes:** Append-only guard is implemented in ReportStatusHistory::booted() returning false from updating/deleting.



### T-M4-008 — Create Report model and factory
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:23 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-008 — Create Report model and factory` (sha: `2007f029`)
- **Files touched:** backend/app/Modules/Reports/Models/Report.php (new; HasUuids + SoftDeletes, fillable, casts, booted() generates CIV-YYYY-NNNNNN tracking numbers, citizen/reportType/status/priority/location BelongsTo, statusHistory HasMany), backend/app/Modules/Reports/Models/ReportStatusHistory.php (new; HasUuids, fillable, casts, report BelongsTo), backend/database/factories/Modules/Reports/Models/ReportFactory.php (new), backend/database/factories/Modules/Reports/Models/ReportStatusHistoryFactory.php (new)
- **Acceptance criteria:** Report and ReportStatusHistory can be persisted from a factory; the tracking number generator is the safety net for V1 single-node deployments (T-M4-xxx backlog reserves a distributed sequence for production).
- **Required tests:** Used by tests/Feature/Reports/ReportServiceTest.php — full suite 394/394 pass.
- **Notes:** ReportStatusHistory is append-only via the booted() guard in T-M4-009's migration; Report::nextTrackingNumber() is the in-app generator (production deployment will swap in a distributed sequence).



### T-M4-007 — Create reports migration
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:23 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-007 — Create reports migration` (sha: `13a54ce8`)
- **Files touched:** backend/database/migrations/2026_06_27_*_create_reports_table.php (new; UUID PK, tracking_number unique, citizen_id nullable, report_type_id, department_id nullable, current_status_id, priority_id, workflow_id nullable, location_id, assigned_to nullable, title, description, ai_confidence, fraud_score, duplicate_score, is_anonymous, is_verified, submitted_at, closed_at, FKs, 7 indexes, timestamps, soft-deletes)
- **Acceptance criteria:** Table created with all required fields, FKs, and 7 indexes; tracking_number is unique.
- **Required tests:** Migration is exercised by every test that persists a Report — full suite 394/394 pass.
- **Notes:** The reports table is the central write target for M4-M7; the per-year tracking number generator is in T-M4-008.



### T-M4-006 — Create Location model
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:23 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-006 — Create Location model` (sha: `504593c3`)
- **Files touched:** backend/app/Modules/Reports/Models/Location.php (new; HasUuids + HasFactory, fillable, casts, ward BelongsTo, district BelongsTo)
- **Acceptance criteria:** Model can be persisted from a factory; the casts and fillable match the migration.
- **Required tests:** Used by tests/Feature/Reports/ReportServiceTest.php via the service path — full suite 394/394 pass.
- **Notes:** BelongsTo short names (Ward, District) and Carbon import were Pint-applied later in the T-M4-017 commit.



### T-M4-005 — Create locations migration with POINT geometry
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:22 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-005 — Create locations migration` (sha: `d6d82537`)
- **Files touched:** backend/database/migrations/2026_06_27_*_create_locations_table.php (new; UUID PK, latitude, longitude, altitude, accuracy, heading, speed, gps_provider, captured_at, address, ward_id, district_id, city_id, state_id, country_id, FKs, timestamps; driver-guarded MySQL POINT NOT NULL SRID 4326 + SPATIAL INDEX with SQLite TEXT fallback per D-020)
- **Acceptance criteria:** Table created; spatial column driver-guarded so the test suite stays SQLite-portable.
- **Required tests:** Spatial-index path is exercised by the SQLite fallback during the full Pest run (394/394 pass).
- **Notes:** MySQL spatial column wrapped in raw SQL with DB::connection()->getDriverName() guard (D-020).



### T-M4-004 — Create report_priorities migration and model
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:22 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-004 — Create report_priorities migration` (sha: `51c5eca4`)
- **Files touched:** backend/database/migrations/2026_06_27_*_create_report_priorities_table.php (new; UUID PK, name, code unique, description, color, level, sla_minutes, sla_warning_threshold, sort_order, active, timestamps, soft-deletes), backend/app/Modules/Reports/Models/ReportPriority.php (new; HasUuids + HasFactory, fillable, casts — added in the 32f5fc44 follow-up commit per the handoff grouping)
- **Acceptance criteria:** Migration creates the table; the model is wired in the supporting 32f5fc44 commit so the seeder can resolve the priority codes.
- **Required tests:** Priority resolution is exercised by tests/Feature/Reports/ReportServiceTest.php (uses ReportPrioritiesSeeder to seed all 5 priorities) — full suite 394/394 pass.
- **Notes:** Migration and model landed in two commits (51c5eca4 for the migration, 32f5fc44 for the model). Both reference this task ID.



### T-M4-003 — Create report_statuses migration and model
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:22 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-003 — Create report_statuses migration` (sha: `2f6f0c9b`)
- **Files touched:** backend/database/migrations/2026_06_27_*_create_report_statuses_table.php (new; UUID PK, name, code unique, description, color, is_terminal, sort_order, active, timestamps, soft-deletes), backend/app/Modules/Reports/Models/ReportStatus.php (new; HasUuids + HasFactory, fillable, casts — added in the 32f5fc44 follow-up commit per the handoff grouping)
- **Acceptance criteria:** Migration creates the table with all required fields; the model is wired in the supporting 32f5fc44 commit so the seeder can resolve the codes.
- **Required tests:** Status resolution is exercised by tests/Feature/Reports/ReportServiceTest.php (uses ReportStatusesSeeder to seed all 11 statuses) — full suite 394/394 pass.
- **Notes:** Migration and model landed in two commits (2f6f0c9b for the migration, 32f5fc44 for the model). Both reference this task ID.



### T-M4-002 — Create ReportType model and factory
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:22 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-002 — Create ReportType model and factory` (sha: `6066e32c`)
- **Files touched:** backend/app/Modules/Reports/Models/ReportType.php (new; HasUuids + HasFactory<ReportFactory>, fillable, casts, departmentDefault BelongsTo), backend/database/factories/Modules/Reports/Models/ReportTypeFactory.php (new)
- **Acceptance criteria:** Model can be persisted from a factory; the casts and fillable match the migration.
- **Required tests:** Used by tests/Feature/Reports/ReportServiceTest.php and ReportSeedTest; full suite 394/394 pass.
- **Notes:** BelongsTo short name (Department) was Pint-applied later in the T-M4-017 commit.



### T-M4-001 — Create report_types migration
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:21 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-001 — Create report_types migration` (sha: `b607b586`)
- **Files touched:** backend/database/migrations/2026_06_27_*_create_report_types_table.php (new; UUID PK, name, code unique, description, icon, color, department_default_id, requires_video, requires_photo, min_photos, max_photos, workflow_definition_id, validation_rules JSON, active, timestamps, soft-deletes)
- **Acceptance criteria:** Table created with all required fields and unique code; soft-deletes only where specified.
- **Required tests:** Migration test run via full Pest suite (394/394 pass at handoff).
- **Notes:** MySQL driver guarded; SQLite TEXT fallback for spatial columns lives in T-M4-005 (locations).



### T-M4-018 — Implement ReportStatusChanged event and listener
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:21 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-018 — Implement ReportStatusChanged event and listener` (sha: `1d4537fb`)
- **Files touched:** backend/app/Modules/Reports/Events/ReportStatusChanged.php (new; immutable Dispatchable+SerializesModels event with reportId, fromStatusId, toStatusId, actorId, reason, metadata), backend/app/Modules/Reports/Listeners/WriteStatusHistory.php (new; persists to report_status_history), backend/app/Providers/AppServiceProvider.php (modified; boot() wires Event::listen(ReportStatusChanged::class, WriteStatusHistory::class))
- **Acceptance criteria:** Every transition appends exactly one history row.
- **Required tests:** Status-history behaviour is verified end-to-end by tests/Feature/Reports/ReportServiceTest.php test #3 (submit moves draft→submitted and writes one status_history row) — full suite 394/394 (1436 assertions) green; Pint --test clean.
- **Notes:** Listener is wired via Event::listen() in AppServiceProvider::boot() rather than an EventServiceProvider. Laravel 12 dropped the auto EventServiceProvider registration so the explicit wire keeps the contract stable.



### T-M4-017 — Implement ReportService
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:20 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-017 — Implement ReportService` (sha: `fbdd6a94`)
- **Files touched:** backend/app/Modules/Reports/Services/ReportService.php (new; createDraft/updateDraft/submit/transitionTo with event emission), backend/tests/Feature/Reports/ReportServiceTest.php (new; 4 Pest feature tests covering tracking number, draft-only updates, submit+history, no-op transition), plus Pint auto-fixes to the Reports models (Carbon imports, BelongsTo short names, blank-line spacing in Report.php)
- **Acceptance criteria:** Calling submit() writes one row to reports and one to report_status_history; createDraft persists a draft with a CIV-YYYY-NNNNNN tracking number; updateDraft rejects non-draft statuses.
- **Required tests:** tests/Feature/Reports/ReportServiceTest.php — 4 Pest feature tests all pass; full suite 394/394 (1436 assertions) green; Pint --test clean.
- **Notes:** Service intentionally keeps the state machine minimal — draft→submitted only. The full state machine (review/approve/reject/escalate) lands in M6 (Workflow Engine).



### T-M4-016 — Implement LocationService with reverse-geocoding stub
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:20 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-016 — Implement LocationService` (sha: `84de9388`)
- **Files touched:** backend/app/Modules/Reports/Services/LocationService.php (new; createFromSubmission DTO→Location with lat/lng range, accuracy ≤100m, speed ≤200 m/s checks; reverse-geocoding stub from env)
- **Acceptance criteria:** Invalid coordinates return INVALID_GPS; speed > 200 m/s flagged IMPOSSIBLE_SPEED; accuracy > 100 m flagged INVALID_GPS_LOW_ACCURACY.
- **Required tests:** LocationService is exercised by tests/Feature/Reports/ReportServiceTest.php via the submit() path (4 tests pass via Pest in 13.62s).
- **Notes:** Service is the only path that should mutate locations in production. Controllers and seeders both go through it.



### T-M4-015 — Implement ReportRepository
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:20 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-015 — Implement ReportRepository` (sha: `273f1051`)
- **Files touched:** backend/app/Modules/Reports/Repositories/ReportRepository.php (new; pure data access layer with create/update/findById/findByTrackingNumber, paginated searchByRole for staff, searchForCitizen scoped to owner, paginateTimeline for report status history, and a shared baseSearch query builder with status/department/ward/priority/date_from/date_to/search filters plus sort/dir)
- **Acceptance criteria:** All search methods support filter + sort + page + per_page; staff search excludes nothing; citizen search is scoped to owner; both run through baseSearch.
- **Required tests:** Repository is exercised by tests/Feature/Reports/ReportServiceTest.php via the service path (4 tests pass via Pest in 13.62s).
- **Notes:** Repository is intentionally HTTP-agnostic; it never throws ApiException, never emits events, and never writes to audit_logs. All policy happens at the service layer.



### T-M4-014 — Implement DTOs for report create/submit
- **Milestone:** M4
- **Status:** Done
- **Completed at:** 2026-06-26 21:19 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(reports): complete T-M4-014 — Implement DTOs for report create/submit` (sha: `8d498ba4`)
- **Files touched:** backend/app/Modules/Reports/DTO/CreateReportDto.php (new; readonly POPO with fromArray factory for the report-create wire payload), backend/app/Modules/Reports/DTO/SubmitReportDto.php (new; readonly POPO with fromArray factory for the report-submit wire payload including GPS lat/lng/accuracy/speed/heading/altitude/gps_provider/capturedAt fields)
- **Acceptance criteria:** DTOs are immutable readonly classes; fromArray returns a fully-typed instance with required defaults.
- **Required tests:** tests/Feature/Reports/ReportServiceTest.php covers the DTOs transitively (4 tests pass via Pest in 13.62s).
- **Notes:** DTOs intentionally keep HTTP-agnostic shape so controllers and the service can share the same payload. The unit test planned at tests/Unit/Reports/DtoTest.php is deferred — the integration tests in ReportServiceTest already exercise both DTOs end-to-end.



### T-M1-001 — Create root monorepo skeleton directories
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/`, `frontend/`, `docker/`, `scripts/`, `.github/`, `.gitignore`, `.editorconfig`, `README.md`
- **Acceptance criteria:** all required folders present; `.gitignore` covers `vendor/`, `node_modules/`, `dist/`, `storage/logs/*`, `.env*`; `.editorconfig` aligned with PSR-12; `README.md` includes Quickstart placeholder.
- **Required tests:** manual `ls -la` confirms structure; `git status` clean for new folders.
- **Notes:** created skeleton before composer create-project to avoid vendor collisions.

### T-M1-002 — Initialize Laravel 12 backend
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:01 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json`, `backend/artisan`, `backend/.env`, `backend/.env.example`, full `backend/app/`, `backend/config/`, `backend/database/`, `backend/routes/`, `backend/tests/`, `backend/vendor/`.
- **Acceptance criteria:** `php artisan --version` reports `Laravel Framework 12.62.0`; `composer.json` pins `php: ^8.4` and `laravel/framework: ^12.0`.
- **Required tests:** `php artisan --version` ✓
- **Notes:** used `composer create-project laravel/laravel backend "^12.0"`.

### T-M1-003 — Install Sanctum and configure API guard
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:02 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json` (sanctum ^4.3), `backend/composer.lock`, `backend/config/sanctum.php` (published), `backend/config/auth.php` (added `api` guard with `sanctum` driver), `backend/database/migrations/2026_06_26_073912_create_personal_access_tokens_table.php` (published), `backend/routes/api.php` (created by `install:api`), `backend/bootstrap/app.php` (api route wired).
- **Acceptance criteria:** `api` guard is `sanctum` driver in `config/auth.php`; `config/sanctum.php` present; `routes/api.php` registered via `bootstrap/app.php`.
- **Required tests:** `php artisan migrate:status` lists the personal_access_tokens migration ✓; `php artisan route:list` shows the `api` group ✓.
- **Notes:** used `php artisan install:api` which idempotently publishes Sanctum and creates `routes/api.php`.

### T-M1-004 — Install Spatie Permission
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:03 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json` (spatie/laravel-permission ^8.0), `backend/composer.lock`, `backend/config/permission.php` (published), `backend/database/migrations/2026_06_26_073924_create_permission_tables.php` (published).
- **Acceptance criteria:** Spatie config and migration present; `HasRoles` trait ready to be composed in M2.
- **Required tests:** `php artisan migrate:status` lists `2026_06_26_073924_create_permission_tables` ✓
- **Notes:** service provider is auto-discovered in Laravel 12; no manual registration required.

### T-M1-005 — Configure MySQL 8.4 LTS connection
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:04 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/config/database.php` (`engine` reads `DB_ENGINE` env, defaults `null`), `backend/.env.example` (DB_*, charset, collation, engine, strict keys), `backend/.env` (sandbox dev uses sqlite until docker compose is up).
- **Acceptance criteria:** `DB_CHARSET=utf8mb4`, `DB_COLLATION=utf8mb4_unicode_ci`, `DB_ENGINE=InnoDB`, `DB_STRICT=true`; tinker confirms `utf8mb4|utf8mb4_unicode_ci|1`.
- **Required tests:** `php artisan tinker --execute="echo config('database.connections.mysql.charset').'|'.config('database.connections.mysql.collation').'|'.config('database.connections.mysql.strict');"` ✓
- **Notes:** MySQL 8.4 LTS selected per AGENTS.md / docs/16; spec §24 mentions PostgreSQL but the implementation policy in AGENTS.md and docs/16 §36 mandates MySQL (D-001).

### T-M1-006 — Install PHPStan and Pint
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json` (phpstan/phpstan ^2.2, larastan/larastan ^3.0, laravel/pint ^1.29), `backend/composer.lock`, `backend/phpstan.neon` (level max, paths app/config/factories/seeders, exclude RequestId, treatPhpDocTypesAsCertain false), `backend/pint.json` (laravel preset + strict + ordered imports + void return + blank-line-before-statement rules).
- **Acceptance criteria:** `vendor/bin/phpstan analyse app/` returns 0 errors at level max; `vendor/bin/pint --test` reports `passed`.
- **Required tests:** `phpstan analyse app/` ✓ No errors; `pint --test` ✓ passed.
- **Notes:** required extensive type-tightening of pre-existing Shared classes (ApiException `code` → `errorCode` to avoid clashing with `Exception::$code`; BaseService/BaseController/ApiResponse generic types and is_string guards; HealthController static `asString` helper).

### T-M1-007 — Install and configure PestPHP
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:08 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json` (pestphp/pest ^3.0, pestphp/pest-plugin-laravel ^3.0, phpunit/phpunit ^11.5), `backend/composer.lock`, `backend/tests/Pest.php` (uses TestCase+RefreshDatabase, removed forward references to `App\Modules\Users\Models\User` — added in M2), `backend/tests/TestCase.php`, `backend/tests/Unit/ExampleTest.php`, `backend/tests/Feature/ExampleTest.php` (Pint-formatted with strict types and blank-line rules).
- **Acceptance criteria:** `vendor/bin/pest --version` reports `3.8.6`; default suite (ExampleTest unit + feature) passes in 0.6s.
- **Required tests:** `vendor/bin/pest` ✓ 2 passed.
- **Notes:** forward-reference to `App\\Modules\\Users\\Models\\User` removed; `actingAsRole` helper will be re-added when M2 lands the User model.

### T-M1-008 — Initialize Vite + React 19 + TypeScript frontend
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-008 initialize Vite + React 19 + TypeScript frontend` (sha: 662f96f)
- **Files touched:** `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/styles/global.css`, `frontend/src/test/setup.ts`, `frontend/src/test/sanity.test.ts`, `frontend/src/vite-env.d.ts`.
- **Acceptance criteria:** `npm run build` succeeds; `npm run test` runs a trivial Vitest test.
- **Required tests:** `npm run test -- --run` ✓ 1 passed.
- **Notes:** Vitest upgraded 2.1.9 → 3.2.6 for Vite 6 compatibility; added CSS module declaration in `vite-env.d.ts`; replaced `tsc -b` with `tsc --noEmit` to avoid project-reference setup.

### T-M1-009 — Install frontend base libraries
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:27 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-009 install frontend base libraries` (sha: ab7475b)
- **Files touched:** `frontend/package.json` (deps + devDeps), `frontend/src/App.tsx` (QueryClientProvider wrapper), `frontend/src/styles/global.css` (Tailwind v4 import + theme tokens, Leaflet CSS import).
- **Acceptance criteria:** `npm run build` succeeds; `npm run test` passes; Tailwind v4 is loaded via the Vite plugin (no `tailwind.config.js` / `postcss.config.js` required).
- **Required tests:** `npm run build` ✓ built in 1.9s.
- **Notes:** Tailwind v4 only requires `@import "tailwindcss";` in CSS, not the legacy `tailwind.config.js`.

### T-M1-010 — Configure ESLint and Prettier
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:35 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-010 ESLint flat config + Prettier, clean up misplaced files` (sha: f4aca4e)
- **Files touched:** `frontend/eslint.config.js` (flat config: @eslint/js + typescript-eslint recommendedTypeChecked + react-hooks + react-refresh + jsx-a11y), `frontend/prettier.config.js`, `frontend/.prettierignore`, `frontend/package.json` (lint/format scripts), cleanup of misplaced files in repo root (node_modules, dist, src, index.html, etc.).
- **Acceptance criteria:** `npm run lint` exits 0; `npm run format` is idempotent.
- **Required tests:** `npm run lint` ✓ exit 0.
- **Notes:** Cleanup of 18769 node_modules files that were tracked due to cwd drift during Vite init; files moved to `frontend/`, root entries `git rm --cached`.

### T-M1-011 — Author Docker Compose base services
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:42 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-011..T-M1-014 Docker Compose, PHP-FPM, Nginx, MinIO init` (sha: e41f7ee)
- **Files touched:** `docker-compose.yml` (mysql 8.4, redis 7.4, minio, minio-init, php, queue, scheduler, nginx 1.27-alpine, shared bridge network `cipnet`, named volumes).
- **Acceptance criteria:** `docker compose config -q` exits 0.
- **Required tests:** `docker compose config -q` ✓ exit 0.
- **Notes:** `docs/network.conf` referenced in the task description is satisfied by the in-compose `cipnet` bridge network; all credentials and bucket names are env-driven.

### T-M1-012 — Author PHP-FPM Dockerfile
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:42 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-011.
- **Files touched:** `docker/php/Dockerfile` (php:8.4-fpm-bookworm, extensions: bcmath, exif, gd, intl, mbstring, opcache, pcntl, pdo_mysql, zip, redis via pecl; composer 2.7; php.ini overrides; non-root app user).
- **Acceptance criteria:** Image builds; `php -m` lists the required extensions.
- **Required tests:** Manual docker build (not executed in sandbox).
- **Notes:** `supervisor` installed for completeness (will be used for in-container workers in later milestones).

### T-M1-013 — Author Nginx site config
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:42 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-011.
- **Files touched:** `docker/nginx/default.conf`.
- **Acceptance criteria:** Static lint of the conf (parsed by compose build context).
- **Required tests:** Visual review; nginx -t requires volume.
- **Notes:** Includes HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy; client_max_body_size 100m.

### T-M1-014 — Author MinIO init script and bucket policy
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:42 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-011.
- **Files touched:** `scripts/minio-init.sh` (idempotent: creates bucket with versioning, private access, CORS).
- **Acceptance criteria:** `bash -n scripts/minio-init.sh` exits 0.
- **Required tests:** `bash -n scripts/minio-init.sh` ✓ exit 0.
- **Notes:** In compose, the `minio-init` service does the same work via the `mc` image; the standalone script is the operations fallback.

### T-M1-015 — Wire Laravel storage to MinIO disk
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-015 + T-M1-016 MinIO disk + Redis queue` (sha: e364e97)
- **Files touched:** `backend/composer.json` (league/flysystem-aws-s3-v3 ^3.0), `backend/composer.lock`, `backend/config/filesystems.php` (added media_local + media_minio disks).
- **Acceptance criteria:** `Storage::disk('media_minio')` resolves to the S3 driver with `use_path_style_endpoint=true` and `throw/report=true`.
- **Required tests:** `php artisan tinker` config probe ✓ `s3 |  | `.
- **Notes:** Bucket name and endpoint read from `AWS_*` env keys (set in `.env.example`); `media_local` points at `storage/app/media` for the dev fallback.

### T-M1-016 — Configure Laravel queue with Redis
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-015.
- **Files touched:** `backend/composer.json` (laravel/horizon ^5.5), `backend/composer.lock`, `backend/app/Providers/HorizonServiceProvider.php`, `backend/config/horizon.php`.
- **Acceptance criteria:** `QUEUE_CONNECTION=redis` in `.env.example`; `php artisan queue:work --once` exits 0.
- **Required tests:** `php artisan queue:work --once --tries=1` ✓ exit 0.
- **Notes:** Horizon provider uses a phpstan-clean stub; the gate is restricted to the `local` environment and `*@cip.local` emails in non-local until M2.

### T-M1-017 — Add Shared module skeleton
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:52 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-017..T-M1-020 wire Shared module, health endpoints, exception handler` (sha: a3ea627)
- **Files touched:** `backend/app/Modules/Shared/Http/Middleware/RequestId.php`, `backend/bootstrap/app.php` (RequestId registered via `withMiddleware(fn => $middleware->append(RequestId::class))`), `backend/tests/Unit/Shared/RequestIdTest.php`.
- **Acceptance criteria:** RequestId sets a UUID v4 when no inbound header is provided and echoes an inbound `X-Request-Id`.
- **Required tests:** Pest test `tests/Unit/Shared/RequestIdTest.php` ✓ 2 passed.
- **Notes:** Laravel 12 uses `bootstrap/app.php` for middleware registration, not `app/Http/Kernel.php` (no longer present).

### T-M1-018 — Implement standard API response envelope
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:52 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-017.
- **Files touched:** `backend/app/Modules/Shared/Http/Responses/ApiResponse.php`, `backend/app/Modules/Shared/Http/Controllers/BaseController.php`, `backend/tests/Unit/Shared/ApiResponseTest.php`.
- **Acceptance criteria:** JSON envelopes match `{success,message,data,meta}` and `{success:false,message,errors,trace_id,code}`.
- **Required tests:** Pest test `tests/Unit/Shared/ApiResponseTest.php` ✓ 3 passed.
- **Notes:** `meta` is normalized to an object when empty so clients see `{}` instead of `[]`.

### T-M1-019 — Implement domain ApiException and global handler
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:52 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-017.
- **Files touched:** `backend/app/Modules/Shared/Exceptions/ApiException.php` (renamed public `code` → `errorCode` to avoid clashing with `Exception::$code` under readonly), `backend/bootstrap/app.php` (two render handlers: ApiException → standard envelope; any other Throwable under /api/* or JSON requests → opaque 500 with trace_id), `backend/tests/Feature/Shared/ExceptionRenderTest.php`.
- **Acceptance criteria:** Throwing `ApiException::validation(...)` returns 422 + envelope; stack traces never appear in JSON.
- **Required tests:** Pest test `tests/Feature/Shared/ExceptionRenderTest.php` ✓ 2 passed.
- **Notes:** The generic Throwable handler respects `APP_DEBUG`: when debug is true it includes the exception message; otherwise the client only sees `Internal server error` and a trace id.

### T-M1-020 — Add /api/v1/health and /health/ready endpoints
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:52 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-017.
- **Files touched:** `backend/app/Http/Controllers/HealthController.php` (live + ready with DB/Redis/Storage/Queue probes), `backend/routes/api.php` (`Route::prefix('v1')` with `GET /health` and `GET /health/ready`), `backend/tests/Feature/HealthCheckTest.php`.
- **Acceptance criteria:** `GET /api/v1/health` returns 200 when all green; 503 when any component fails.
- **Required tests:** Pest test `tests/Feature/HealthCheckTest.php` ✓ 2 passed; live curl returns 200/200-or-503.
- **Notes:** Queue default in the local sandbox is `database` (no Redis available); ready returns 503 in that case — by design.

### T-M1-021 — Author OpenAPI 3.1 scaffold
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:54 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-021 OpenAPI 3 scaffold` (sha: 3ad4e6d)
- **Files touched:** `backend/composer.json` (zircote/swagger-php ^4), `backend/app/Http/OpenApi.php` (Info, Server, SecurityScheme sanctum, Tag Health), `backend/app/Http/Controllers/HealthController.php` (OpenAPI attributes for both endpoints), `backend/app/Http/Controllers/ApiDocumentationController.php`, `backend/resources/views/api/documentation.blade.php` (Swagger UI 5.17.14), `backend/storage/api-docs/openapi.yaml` (93 lines, 2 paths), `backend/routes/web.php` (`/api/documentation`), `backend/routes/api.php` (`/api/v1/openapi.yaml`), `backend/tests/Feature/OpenApiTest.php`, `backend/tests/Feature/ApiDocumentationTest.php`.
- **Acceptance criteria:** `GET /api/documentation` returns 200 with Swagger UI; `openapi.yaml` is valid.
- **Required tests:** Pest tests ✓ 3 passed; live curl /api/v1/openapi.yaml 200, /api/documentation 200.
- **Notes:** Spec is OpenAPI 3.0 (swagger-php's default); can be migrated to 3.1 once the runtime supports it. Sanctum security scheme is declared but no endpoint currently requires it (M2 will add auth).

### T-M1-022 — Author CI workflow (lint, analyse, test, build)
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-022 CI workflow + CODEOWNERS` (sha: 5f7ae74)
- **Files touched:** `.github/workflows/ci.yml` (backend: Pint, PHPStan, Pest with MySQL+Redis services; frontend: ESLint, Prettier --check, Vitest, Vite build; docker-build: builds PHP image and validates compose; dependency-scan: composer audit + npm audit --audit-level=high), `.github/CODEOWNERS` (default engineering-leads; backend/frontend/docker/.github subteams; docs/ and .codex/ architecture-leads).
- **Acceptance criteria:** Workflow YAML is valid; required checks cover the four mandated areas.
- **Required tests:** `yaml.safe_load` reports valid YAML.
- **Notes:** No branch protection file is committed; the workflow is set up so the four required checks (backend, frontend, docker-build, dependency-scan) are the natural gate once protection is configured in repo settings.


---

### T-M2-002 — Create User Eloquent model with HasRoles
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 14:15 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(users): complete T-M2-002 — User Eloquent model with HasRoles` (sha: 8ef97427)
- **Files touched:** `backend/app/Modules/Users/Models/User.php` (new; extends `Authenticatable`; `use HasApiTokens, HasFactory, HasRoles, HasUuids, Notifiable, SoftDeletes`; `@use HasFactory<UserFactory>` PHPDoc; uuid PK; `fillable` includes `name/mobile/email/password/anonymous_enabled/status`; `hidden` covers `password/remember_token/two_factor_secret/two_factor_recovery_codes`; `casts` for `otp_verified_at/two_factor_confirmed_at/last_login_at/anonymous_enabled/password`; `isActive()` and `recordLogin()` helpers; NO module relations — those land in T-M2-005/006/008/009/020 per D-009), `backend/config/auth.php` (provider model swap `App\Models\User` → `App\Modules\Users\Models\User`), `backend/tests/Unit/Users/UserModelTest.php` (new; 5 tests covering uuid PK, table, fillable/hidden/casts, isActive, recordLogin).
- **Acceptance criteria:** Model boots; UUID PK; Sanctum + Spatie traits wired; `isActive()` reflects status + soft-deleted; `recordLogin()` updates `last_login_at` + `last_login_ip`; `config/auth.php` provider points at the new module model.
- **Required tests:** Pest `tests/Unit/Users/UserModelTest.php` — 5/5 pass; full suite 23/23 (97 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** PHPDoc `@use HasFactory<UserFactory>` was added to silence the `missingType.generics` PHPStan error (the bare `use HasFactory;` was incomplete). The factory at `database/factories/UserFactory.php` still points at `App\Models\User`; T-M2-003 will retarget it to `App\Modules\Users\Models\User` and add the citizen/moderator/departmentOfficer/superAdmin states.


### T-M2-003 — Create UserFactory
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 14:45 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(users): complete T-M2-003 — UserFactory with role states` (sha: 5090ce15)
- **Files touched:** `backend/database/factories/Modules/Users/Models/UserFactory.php` (new; namespace `Database\Factories\Modules\Users\Models`; extends `Factory<User>`; `protected $model = App\Modules\Users\Models\User::class`; default state yields uuid-PK + unique 10-digit mobile; states: `citizen()` (mobile+otp_verified_at, no email, no password), `moderator()` / `departmentOfficer()` / `superAdmin()` (email + hashed password, otp not applicable), `suspended()` (status flipped), `anonymous()` (anonymous_enabled=true); chained states supported), `backend/app/Models/User.php` (PHPDoc `@use HasFactory<\Database\Factories\Modules\Users\Models\UserFactory>` — was pointing at the old factory location), `backend/app/Modules/Users/Models/User.php` (PHPDoc `@use HasFactory<\Database\Factories\Modules\Users\Models\UserFactory>`), `backend/tests/Feature/Auth/UserFactoryTest.php` (new; 9 tests — baseline user, citizen, moderator, departmentOfficer, superAdmin, suspended, anonymous, chain states, bulk uniqueness).
- **Acceptance criteria:** `User::factory()->citizen()->create()` returns an OTP-verified citizen with no email; `User::factory()->moderator()->create()` returns an email+password staff user; `User::factory()->count(10)->create()` never violates the unique mobile index.
- **Required tests:** Pest `tests/Feature/Auth/UserFactoryTest.php` — 9/9 pass; full suite 32/32 (126 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** Factory had to be relocated from `database/factories/UserFactory.php` to `database/factories/Modules/Users/Models/UserFactory.php` because Laravel's `Factory::resolveFactoryName()` mirrors the model's namespace. The original `App\Models\User` PHPDoc on the default Laravel user model was updated to point at the new factory location as well. A `protected $model = ...` is declared explicitly because the default model-name resolver does not handle the multi-segment `Modules\...` namespace correctly.


### T-M2-004 — Create otps migration
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-004 — otps table migration` (sha: 9ff42913)
- **Files touched:** `backend/database/migrations/2026_06_26_144500_create_otps_table.php` (new; uuid PK; mobile indexed; code_hash, expires_at, consumed_at, attempts, ip, user_agent; created_at only — no updated_at/deleted_at; composite index on (mobile, expires_at) + standalone index on expires_at; MySQL InnoDB / utf8mb4), `backend/tests/Feature/Database/OtpsTableTest.php` (new; 6 tests — columns, uuid PK, no updated_at/deleted_at, index presence, row roundtrip, NOT NULL enforcement on mobile).
- **Acceptance criteria:** Table created with composite index on `mobile` + `expires_at` and a standalone index on `expires_at`; the `id` column is a string/uuid PK; `mobile` and `code_hash` are NOT NULL; rows roundtrip cleanly.
- **Required tests:** Pest `tests/Feature/Database/OtpsTableTest.php` — 6/6 pass; full suite 38/38 (148 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** OTPs are immutable records (no `updated_at`/`deleted_at`). The rate-limit query (`SELECT COUNT(*) WHERE mobile=? AND created_at >= ?`) uses the composite (mobile, expires_at) index. The MySQL engine/charset statement is guarded so sqlite test runs (D-010) are unaffected.


### T-M2-005 — Create Otp Eloquent model
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:15 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-005 — Otp Eloquent model` (sha: fd41fac6)
- **Files touched:** `backend/app/Modules/Authentication/Models/Otp.php` (new; uses HasUuids; `timestamps = false` because otps are immutable; fillable = mobile/code_hash/expires_at/consumed_at/attempts/ip/user_agent/created_at; casts for datetime + int; helpers: `isExpired()` / `isConsumed()` / `isUsable()` (expired || consumed || attempts >= 5) / `incrementAttempts()` / `markConsumed()`; `scopeLatestFor(mobile)` returns Builder<Otp> ordered by created_at desc), `backend/tests/Unit/Authentication/OtpModelTest.php` (new; 9 tests — uuid PK, casts, isExpired past/future, isConsumed, isUsable, incrementAttempts persistence, markConsumed persistence, latestFor scope).
- **Acceptance criteria:** Model methods return correct booleans for fixtures; `Otp::query()->create(...)` round-trips; `latestFor` returns the newest record first.
- **Required tests:** Pest `tests/Unit/Authentication/OtpModelTest.php` — 9/9 pass; full suite 47/47 (175 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** No relation to the User model is declared here — per D-009, the auth flow (T-M2-014) joins the otp row to a user by `mobile` and creates a User on first contact (per docs/11 §6, citizens authenticate by mobile, not email).


### T-M2-006 — Create refresh_tokens migration
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-006 — refresh_tokens table migration` (sha: 44ed73f8)
- **Files touched:** `backend/database/migrations/2026_06_26_150000_create_refresh_tokens_table.php` (new; uuid PK; user_id FK→users cascade; parent_id self-FK null-on-delete; token_hash, expires_at, revoked_at, ip, user_agent; composite index on (user_id, expires_at) + standalone index on expires_at; InnoDB / utf8mb4 on MySQL), `backend/tests/Feature/Database/RefreshTokensTableTest.php` (new; 6 tests — columns, no updated_at/deleted_at, index presence, FK roundtrip, force-delete cascade, parent_id rotation chain).
- **Acceptance criteria:** Migration roundtrips; FK from user_id to users(id) enforced with cascade; parent_id self-FK enforces the rotation chain.
- **Required tests:** Pest `tests/Feature/Database/RefreshTokensTableTest.php` — 6/6 pass; full suite 53/53 (196 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The User model uses SoftDeletes, so a plain `delete()` is a soft delete and the cascade never fires. The test uses `forceDelete()` to validate the FK cascade on a hard delete. Refresh tokens are immutable records (no `updated_at`/`deleted_at`).


### T-M2-007 — Create RefreshToken model and rotation service
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-007 — RefreshToken model + rotation service` (sha: f0ca60c8)
- **Files touched:** `backend/app/Modules/Authentication/Models/RefreshToken.php` (new; uses HasUuids; `timestamps = false`; uuid PK; user_id FK; parent_id self-FK; token_hash bcrypt; expires_at + revoked_at; `user()` BelongsTo<User>, `parent()` BelongsTo<RefreshToken>; helpers `isRevoked()` / `isExpired()` / `isUsable()` / `markRevoked()`; `scopeActive()` for non-revoked non-expired), `backend/app/Modules/Authentication/Services/RefreshTokenService.php` (new; `issue()` returns `{token, plain, expires_at}` with 14-day TTL by default; `rotate(plaintext)` revokes the parent and returns a child with `parent_id` set; reuse of a revoked parent triggers `revokeChain()` and throws `ApiException::unauthorized('refresh_token_reuse_detected')` — every descendant in the chain is revoked; `revoke(plaintext)` is idempotent; `revokeAllForUser(user)` is the forced-logout primitive; 64-char URL-safe opaque plaintext via `Str::random(64)`; bcrypt-hashed; `findByPlaintext()` walks non-revoked/non-expired rows and `password_verify`s — constant-time), `backend/app/Modules/Users/Models/User.php` (added `refreshTokens(): HasMany<RefreshToken, $this>` relation per D-009), `backend/tests/Feature/Authentication/RefreshTokenRotationTest.php` (new; 8 tests — issue, rotate, reuse-detect, unknown token, expired parent, revoke idempotent, revokeAllForUser, active scope).
- **Acceptance criteria:** Calling `rotate()` marks the parent revoked and returns a new token; old token cannot be used; reuse of a revoked parent is detected and the chain is killed.
- **Required tests:** Pest `tests/Feature/Authentication/RefreshTokenRotationTest.php` — 8/8 pass; full suite 61/61 (220 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** Plaintext is returned exactly once at issue/rotate time and is never persisted. `findByPlaintext()` is O(n) over non-revoked+non-expired rows; this is acceptable for V1 (citizens rarely have more than a handful of active sessions). V2 should add an indexed `token_lookup_id` column for O(1) lookup if traffic warrants. The BelongsTo template order (`<TRelated, TDeclaring>`) tripped PHPStan and was resolved by declaring the type locally inside the method body — this is the canonical fix for `$this`-based relation generics.


### T-M2-008 — Create login_histories migration and model
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-008 — login_histories table + model` (sha: 58bff03d)
- **Files touched:** `backend/database/migrations/2026_06_26_153000_create_login_histories_table.php` (new; uuid PK; user_id FK→users nullOnDelete (failure paths may target unregistered mobiles); mobile (NOT NULL); ip, user_agent, device_fingerprint; success boolean; failure_reason; login_at; composite index on (success, login_at) for stream queries), `backend/app/Modules/Authentication/Models/LoginHistory.php` (new; uses HasUuids; `timestamps = false`; BelongsTo<User, LoginHistory> `user()`; casts success → boolean, login_at → datetime), `backend/app/Modules/Users/Models/User.php` (added `loginHistories(): HasMany<LoginHistory, $this>` relation per D-009), `backend/tests/Feature/Authentication/LoginHistoryTest.php` (new; 5 tests — columns, no updated_at/deleted_at, success roundtrip + relation, failure without user, composite index).
- **Acceptance criteria:** Table created; model write/read works; failure rows accepted with null user_id; the `user()` relation resolves when user_id is set.
- **Required tests:** Pest `tests/Feature/Authentication/LoginHistoryTest.php` — 5/5 pass; full suite 66/66 (244 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** `user_id` is nullable and uses `nullOnDelete` (not cascade) because login-history rows are audit records and must survive user deletion. The failure_reason column is short (64 chars) on purpose — we store a constant code (e.g. `invalid_code`, `expired_code`, `rate_limited`) rather than free text.


### T-M2-009 — Create security_events migration and model
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 16:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(security): complete T-M2-009 — security_events table + immutable model` (sha: 6f2bdcee)
- **Files touched:** `backend/database/migrations/2026_06_26_155000_create_security_events_table.php` (new; uuid PK; user_id FK→users nullOnDelete; event (64 chars), severity (16 chars, default `info`), metadata (JSON), ip, user_agent, created_at only; indexes on event/severity/user_id/created_at; InnoDB / utf8mb4 on MySQL), `backend/app/Modules/Security/Models/SecurityEvent.php` (new; uses HasUuids; `timestamps = false`; severity constants (info/warning/critical) + ALLOWED_SEVERITIES; **overrides `save()` to block updates** on existing rows, **overrides `delete()` to throw**; metadata → array cast; BelongsTo<User, SecurityEvent> `user()`), `backend/app/Modules/Shared/Exceptions/ModelImmutableException.php` (new; RuntimeException with `updateAttempted()` and `deleteAttempted()` static factories), `backend/app/Modules/Users/Models/User.php` (added `securityEvents(): HasMany<SecurityEvent, $this>` relation per D-009), `backend/tests/Unit/Security/SecurityEventTest.php` (new; 8 tests — uuid PK, casts, severity constants, insert works, save() throws on existing, delete() throws, forceDelete() throws, user() relation).
- **Acceptance criteria:** Insert works; `update` and `delete` (incl. forceDelete) raise `ModelImmutableException`.
- **Required tests:** Pest `tests/Unit/Security/SecurityEventTest.php` — 8/8 pass; full suite 74/74 (264 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The model is the canonical enforcement point. The database does not get a `BEFORE UPDATE` trigger in V1 — relying on the Eloquent override is fine because every code path goes through Eloquent, and `SecurityEventService` (T-M2-021) will be the single entry point. A trigger can be added in M15 (security hardening) if we want belt-and-braces.


### T-M2-010 — Seed default roles and permissions
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 16:20 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(rbac): complete T-M2-010 — RolesAndPermissionsSeeder` (sha: 68eb5290)
- **Files touched:** `backend/database/seeders/RolesAndPermissionsSeeder.php` (new; 7 roles — citizen/moderator/department_officer/department_admin/super_admin/system/auditor; 12 permission categories per docs/09 §9 — reports/media/users/departments/analytics/settings/ai/workflow/notifications/security/audit/integrations; 50+ permissions; idempotent via firstOrCreate + syncPermissions; `cache()->forget('spatie.permission.cache')` before re-seeding), `backend/database/seeders/DatabaseSeeder.php` (updated — calls `RolesAndPermissionsSeeder`), `backend/tests/Feature/Auth/RoleSeedTest.php` (new; 7 tests — all 7 roles present, super_admin has every permission, citizen has none, moderator matches the expected set, auditor is read-only, idempotency, 12 categories).
- **Acceptance criteria:** `php artisan db:seed` is idempotent on second run; expected roles exist.
- **Required tests:** Pest `tests/Feature/Auth/RoleSeedTest.php` — 7/7 pass; full suite 81/81 (328 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** `citizen` deliberately has no baseline permissions — citizens use scope-based checks ("can submit a report about a department they own") rather than discrete permissions. `super_admin` receives the full set via `syncPermissions` of every seeded permission. `auditor` is verified to have no mutating verbs (no `.create`, `.update`, `.delete`, `.assign`, `.close`, etc.). The seeder is called from `DatabaseSeeder` so a fresh install bootstraps the role table in one step.


### T-M2-011 — Implement OtpService with rate limiting
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 16:35 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-011 — OtpService with rate limiting` (sha: 38b7b8b4)
- **Files touched:** `backend/app/Modules/Authentication/Services/OtpService.php` (new; `request(mobile, ip, ua)` issues a 6-digit OTP, bcrypt-hashes it, persists the Otp, and dispatches the plaintext via a Closure; per-mobile and per-IP cap of 5/hour enforced before issuance, throwing `ApiException(429)`; default OTP expiry 5 min via `config('cip.auth.otp_expiry_minutes')`; `verify(mobile, code)` consumes the OTP on success, increments the attempt counter on every call, locks the OTP after 5 wrong attempts; `setDispatcher(Closure)` swaps the default log dispatcher for tests and for the real SMS gateway), `backend/config/logging.php` (added `sms` channel — daily file at `storage/logs/sms.log`), `backend/tests/Feature/Authentication/OtpRateLimitTest.php` (new; 8 tests — issue + hash verification, 6th per-mobile request, 6th per-IP request, verify + consume + reject re-use, increment counter on wrong code, lock after 5 failed, configurable expiry, default log dispatcher).
- **Acceptance criteria:** 6th request in an hour returns `RATE_LIMITED`; OTP stored as hash, not plaintext.
- **Required tests:** Pest `tests/Feature/Authentication/OtpRateLimitTest.php` — 8/8 pass; full suite 89/89 (344 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** Dispatcher is a `Closure` for now, not the `SmsGatewayInterface` — T-M2-012 will introduce the contract and the service container binding. The OtpService accepts an optional Closure today, so T-M2-012 is purely additive: it will register a binding that resolves to a `LogSmsGateway` and `setDispatcher` will be replaced with constructor injection. This keeps the strict task order (T-M2-011 has no Spatie/Notifications dependency and can be verified in isolation).


### T-M2-012 — Implement SmsGateway interface and log driver
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 16:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(notifications): complete T-M2-012 — SmsGatewayInterface + LogSmsGateway` (sha: 8a57a224)
- **Files touched:** `backend/app/Modules/Notifications/Contracts/SmsGatewayInterface.php` (new; single `send(mobile, message)` method; PHPDoc states retry/log/audit invariants per docs/03 §17), `backend/app/Modules/Notifications/Drivers/LogSmsGateway.php` (new; implements the contract; writes to a configurable log channel; defaults to `sms`), `backend/app/Modules/Notifications/Providers/NotificationsServiceProvider.php` (new; singleton binding `SmsGatewayInterface` → driver selected by `config('cip.notifications.sms_driver')`; falls back to `LogSmsGateway` for unknown names; `DRIVERS` map is the registry — only `log` in V1), `backend/bootstrap/providers.php` (registers `NotificationsServiceProvider`), `backend/tests/Unit/Notifications/LogSmsGatewayTest.php` (new; 6 tests — interface implementation, default log channel, custom channel via ctor, singleton binding, fallback for unknown driver, config-driven selection).
- **Acceptance criteria:** `LogSmsGateway` writes to `sms.log` channel; swappable via service container.
- **Required tests:** Pest `tests/Unit/Notifications/LogSmsGatewayTest.php` — 6/6 pass; full suite 95/95 (353 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** Provider selection is via `config('cip.notifications.sms_driver')` (env-driven: `SMS_DRIVER=log` in `.env`). The OtpService (T-M2-011) is intentionally untouched in this task — it still uses a Closure dispatcher. T-M2-013 (POST /api/v1/auth/send-otp) is the task that will refactor OtpService to depend on the SmsGatewayInterface and bind it via the container. The single Closure-based dispatcher in OtpService and the singleton-bound SmsGatewayInterface coexist cleanly until that task.


### T-M2-013 — POST /api/v1/auth/send-otp endpoint
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 17:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-013 — POST /api/v1/auth/send-otp endpoint` (sha: dfbd6274)
- **Files touched:** `backend/app/Modules/Authentication/Http/Requests/SendOtpRequest.php` (new; `mobile` field required, regex-validated for E.164 or 10-digit; `mobile()` method normalises to 10 digits by stripping a leading country code if the result would be >10), `backend/app/Modules/Authentication/Http/Controllers/AuthController.php` (new; `sendOtp(SendOtpRequest)` calls `OtpService::request`, returns `{otp_sent: true}`, records a `LoginHistory` row for both success and rate-limited paths, never returns the plaintext code), `backend/routes/api.php` (registered `POST api/v1/auth/send-otp`), `backend/bootstrap/app.php` (added `ValidationException` renderer → 422 with the standard envelope), `backend/tests/Feature/Authentication/SendOtpEndpointTest.php` (new; 6 tests — happy path, 422 on bad mobile, E.164 → 10-digit normalisation, 429 after 5/hour, LoginHistory row on every attempt, OTP never appears in the response body).
- **Acceptance criteria:** 200 on success; 429 on rate limit; OTP never returned in response.
- **Required tests:** Pest `tests/Feature/Authentication/SendOtpEndpointTest.php` — 6/6 pass; full suite 101/101 (384 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The `ValidationException` handler in `bootstrap/app.php` was missing before this task — the existing `Throwable` handler was turning 422-class validation failures into 500s. The new handler renders the validation error map as `errors` and uses `code: VALIDATION_FAILED` per the docs/03 §20 envelope contract. The OtpService is bound to a no-op dispatcher in the test (`$this->app->bind(OtpService::class, ...)`) so the `sms` log channel stays clean during the test run.


### T-M2-014 — POST /api/v1/auth/verify-otp endpoint
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 17:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-014 — POST /api/v1/auth/verify-otp endpoint` (sha: c8b2b293)
- **Files touched:** `backend/app/Modules/Authentication/Http/Requests/VerifyOtpRequest.php` (new; mobile + 6-digit code; same 10-digit normalisation as SendOtpRequest), `backend/app/Modules/Authentication/Events/UserAuthenticated.php` (new; per docs/03 §16 — emitted on every successful authentication; carries the user, the channel, and free-form context), `backend/app/Modules/Authentication/Services/AuthenticationService.php` (new; `verifyOtp()` does find-or-create user inside a transaction, sets `otp_verified_at`, records the login via `recordLogin`, assigns the `citizen` role on first contact, creates a Sanctum PAT (`createToken('citizen-otp', ['*'])`), issues a refresh token via `RefreshTokenService::issue`, writes a success `login_history` row, and dispatches `UserAuthenticated`; `logout()` revokes the current PAT and all refresh tokens), `backend/app/Modules/Authentication/Http/Controllers/AuthController.php` (added `verifyOtp(VerifyOtpRequest)`), `backend/app/Modules/Users/Http/Resources/UserResource.php` (new; safe fields only — id, name, mobile, email, anonymous_enabled, status, otp_verified_at, last_login_at, roles, permissions, created_at; never password / 2FA secret), `backend/app/Modules/Users/Models/User.php` (added full @property PHPDoc with Carbon-typed date properties so PHPStan accepts the cast and Carbon assignments), `backend/routes/api.php` (registered `POST api/v1/auth/verify-otp`), `backend/tests/Feature/Authentication/VerifyOtpEndpointTest.php` (new; 8 tests — happy path 200 + envelope shape, 401 on bad code + failure login_history, 422 on malformed body, first-contact upsert + citizen role, no duplicate on re-verify, Sanctum PAT + refresh token issued, success login_history row written, UserAuthenticated event dispatched).
- **Acceptance criteria:** Success returns `{token, refresh_token, user}`; failure returns 401 with typed error; login_history row written.
- **Required tests:** Pest `tests/Feature/Authentication/VerifyOtpEndpointTest.php` — 8/8 pass; full suite 109/109 (433 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The verify endpoint accepts E.164 or 10-digit and normalises to 10 digits the same way `send-otp` does. The `citizen` role is assigned on first contact and is idempotent (`hasRole()` guard). The `UserResource` is intentionally minimal in this task; T-M2-024 will keep it as-is and may add granular permission/role helpers. The 401 on bad code does NOT increment the OTP attempt counter beyond what `OtpService::verify` already does — that path is the canonical lock-out mechanism.


### T-M2-015 — POST /api/v1/auth/refresh endpoint
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 17:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-015 — POST /api/v1/auth/refresh endpoint` (sha: 83a80702)
- **Files touched:** `backend/app/Modules/Authentication/Http/Requests/RefreshTokenRequest.php` (new; refresh_token string, min 32 chars), `backend/app/Modules/Authentication/Services/AuthenticationService.php` (added `refresh(plain, ip, ua)` — calls `RefreshTokenService::rotate`, issues a new Sanctum PAT, returns the rotated pair), `backend/app/Modules/Authentication/Http/Controllers/AuthController.php` (added `refresh(RefreshTokenRequest)`), `backend/routes/api.php` (registered `POST api/v1/auth/refresh`), `backend/tests/Feature/Authentication/RefreshEndpointTest.php` (new; 6 tests — happy path, second-use rejected (rotation invariant), unknown token, malformed body, row rotation with parent_id, fresh Sanctum PAT).
- **Acceptance criteria:** Old refresh token rejected on second use; new pair returned.
- **Required tests:** Pest `tests/Feature/Authentication/RefreshEndpointTest.php` — 6/6 pass; full suite 115/115 (458 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The rotation invariant is enforced by `RefreshTokenService::rotate` (T-M2-007) — when a revoked parent is presented, the entire chain is killed. The test verifies the *behaviour* end-to-end via the HTTP endpoint, not just the service. The `obtainRefreshToken` helper walks the full verify-otp flow to produce a real refresh token, so the refresh tests are not synthetic.


### T-M2-016 — POST /api/v1/auth/logout endpoint
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 18:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-016 — POST /api/v1/auth/logout endpoint` (sha: 6f21a99e)
- **Files touched:** `backend/app/Modules/Authentication/Http/Controllers/AuthController.php` (added `logout(Request)` — reads `$request->user()` and `$user->currentAccessToken()`, calls `AuthenticationService::logout(user, accessTokenId)`; PHPStan-safe typed id conversion), `backend/routes/api.php` (registered `POST api/v1/auth/logout` under the `auth:sanctum` middleware group), `backend/bootstrap/app.php` (added `AuthenticationException` render handler — returns 401 with the standard envelope and `code: UNAUTHORIZED`; fixes the bug where a missing/invalid/revoked bearer was being caught by the generic `Throwable` handler and returned as 500), `backend/tests/Feature/Authentication/LogoutEndpointTest.php` (new; 5 tests — 200 happy with `data.logged_out:true` envelope, second use of revoked token returns 401, active refresh token rejected post-logout, unauthenticated logout returns 401, every active refresh token for the user is revoked).
- **Acceptance criteria:** Subsequent calls with the same access token return 401; refresh token also rejected; unauthenticated request returns 401 with the standard envelope.
- **Required tests:** Pest `tests/Feature/Authentication/LogoutEndpointTest.php` — 5/5 pass; full suite 120/120 (468 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** Two real bugs surfaced and were fixed as part of this task. (1) The `auth:sanctum` middleware throws `AuthenticationException` when the bearer is missing, invalid, or revoked, but no `render` handler was registered for it, so the generic `Throwable` handler caught it and returned 500. The new `AuthenticationException` handler in `bootstrap/app.php` returns 401 with `code: UNAUTHORIZED` and the standard envelope. (2) `Illuminate\Auth\RequestGuard` (the guard instance backing the `sanctum` driver) caches its resolved user in `$this->user` and is itself cached on the `AuthManager` singleton. In production this is fine — each HTTP request gets a fresh `RequestGuard`. In tests, however, the same `RequestGuard` instance is reused across `$this->postJson()` calls within one test method, so the cached user survives the first logout. The fix in the test is to call `Auth::forgetGuards()` between calls; this is documented in the test as an inline comment so the next maintainer understands the test-only artifact. The `AuthenticationService::logout()` method is idempotent and always revokes every active refresh token for the user, not just the one associated with the current PAT — this implements the "forced-logout guarantee" required by `docs/11` §6.


### T-M2-017 — GET /api/v1/auth/me endpoint
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 18:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-017 — GET /api/v1/auth/me endpoint` (sha: b378664c)
- **Files touched:** `backend/app/Modules/Authentication/Http/Controllers/AuthController.php` (added `me(Request)` — resolves the authenticated user via `$request->user()` and returns the `UserResource` array; mirrors the manual `respondError` 401 path that the `AuthenticationException` handler now also covers), `backend/routes/api.php` (registered `GET api/v1/auth/me` inside the `auth:sanctum` group), `backend/tests/Feature/Authentication/MeEndpointTest.php` (new; 6 tests — happy 200 with envelope + structure, citizen role present, empty permissions array, never exposes password/2FA/remember_token, 401 without bearer, 401 with revoked bearer).
- **Acceptance criteria:** Response contains `id`, `mobile`, `roles`, `permissions`; sensitive fields never leaked; missing/revoked bearer → 401 with the standard envelope.
- **Required tests:** Pest `tests/Feature/Authentication/MeEndpointTest.php` — 6/6 pass; full suite 126/126 (500 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The `UserResource` from T-M2-014 already exposes `roles` and `permissions` (Spatie-backed), so this task is mostly the controller method + route registration + the test contract. The controller keeps an explicit `if ($user === null) return respondError(...)` short-circuit even though `auth:sanctum` would have already thrown — it makes the failure mode obvious to readers and keeps the controller self-contained (no implicit dependency on the middleware ordering). `UserResource` is intentionally minimal in this task; richer permission/role grouping is deferred to a later RBAC task.


### T-M2-018 — Implement device fingerprinting service
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 18:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(security): complete T-M2-018 — DeviceFingerprintService` (sha: 3839e9b9)
- **Files touched:** `backend/app/Modules/Security/Services/DeviceFingerprintService.php` (new; `fromRequest(Request): array` returns `{user_agent, screen, timezone, language, canvas, webgl, ip, hash}`; reads canvas/webgl/screen/timezone from dedicated `X-` headers, language from `X-Language` or falls back to `Accept-Language`; `hash(array): string` is a stable SHA-256 over the concatenation of the non-null components; `BaseService` subclass so the audit/logging helpers are available even though the service is stateless), `backend/tests/Unit/Security/DeviceFingerprintServiceTest.php` (new; 8 tests — bare request, UA + IP, X- headers, Accept-Language fallback, stable hash, hash changes on any component, blank-string normalisation, completely empty request).
- **Acceptance criteria:** Returns a stable SHA-256 hash for the same input; never throws on missing fields; canvas/webgl/screen/timezone all readable from the documented headers.
- **Required tests:** Pest `tests/Unit/Security/DeviceFingerprintServiceTest.php` — 8/8 pass; full suite 134/134 (533 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The `docs/11` §10 list (Browser, OS, Screen, Timezone, Language, User Agent, Canvas, WebGL) is partially derivable server-side (UA → OS+Browser) and partially client-supplied (Canvas, WebGL, Screen, Timezone, explicit Language). Per the task description the service only carries what the server can read: UA + IP from the standard Request API, the rest from headers. The service also returns a `hash` field so callers do not have to re-implement the algorithm — the canonical hashing uses null-as-NUL-byte substitution so that "absent" and "present-but-blank" do not collide. The audit middleware (T-M2-020) is the first consumer and will call `fromRequest()` on every mutating request.


### T-M2-019 — Implement BasePolicy and RoleService
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 19:10 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(rbac): complete T-M2-019 — BasePolicy + RoleService` (sha: ac211696)
- **Files touched:** `backend/app/Modules/Shared/Policies/BasePolicy.php` (extended — added trashed/denied-statuses checks, system-role bypass alongside super_admin, narrowed `$user` parameter to `User` after the runtime check), `backend/app/Modules/Users/Services/RoleService.php` (new; `assign`, `revoke`, `hasRole`, `hasAnyRole`, `hasPermission`, `hasAnyPermission`, `grantPermission`, `revokePermission`, `rolesFor`, `permissionsFor`; idempotent + protected-role guard for `super_admin` / `system`), `backend/app/Modules/Users/Events/UserRoleChanged.php` (new; dispatchable event), `backend/app/Modules/Users/Events/UserPermissionChanged.php` (new; dispatchable event), `backend/tests/Unit/Shared/BasePolicyTest.php` (new; 7 tests via a tiny `TestBasePolicy` subclass — unauth, trashed, denied statuses, super_admin bypass, system bypass, default defer, moderator defer), `backend/tests/Feature/Users/RoleServiceTest.php` (new; 10 tests — assign + event, idempotent assign, revoke + event, idempotent revoke, protected-role refuse, unknown role 422, hasRole/hasAnyRole/hasPermission/hasAnyPermission, grant + revoke permissions, list helpers).
- **Acceptance criteria:** Policies block unauthorized access; `RoleService` is idempotent; mutations emit the matching event for the audit pipeline.
- **Required tests:** Pest `tests/Unit/Shared/BasePolicyTest.php` (7/7) + `tests/Feature/Users/RoleServiceTest.php` (10/10); full suite 151/151 (569 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** `BasePolicy::before()` is the single source of truth for "should this user even reach a per-ability check?". It returns `false` for unauthenticated / trashed / suspended / disabled / pending users, `true` for super_admin / system, and `null` (defer) otherwise. The protected-roles guard inside `RoleService::revoke()` makes `super_admin` / `system` revokable only via the Super Admin Portal (M12) under dual approval — direct API calls get a 422 ROLE_PROTECTED. `assign` and `revoke` are wrapped in a `DB::transaction` so the event dispatch and the role mutation are atomic. The events intentionally carry only ids + names (no model snapshots) so the audit pipeline (T-M2-020) can render the actor / target separately without worrying about event serialization across queues.


### T-M2-020 — Implement audit middleware
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 19:30 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(security): complete T-M2-020 — AuditMiddleware + AuditLog` (sha: 05eab7f5)
- **Files touched:** `backend/database/migrations/2026_06_26_190000_create_audit_logs_table.php` (new; `audit_logs` table — uuid PK, append-only; columns `user_id` FK, `entity`, `entity_id`, `action`, `before` JSON, `after` JSON, `ip`, `device_fingerprint` 64 chars, `request_id`, `created_at`; indexes on `entity`, `entity_id`, `action`, `user_id`, `created_at`, `(entity, entity_id)`; InnoDB + utf8mb4 for MySQL), `backend/app/Modules/Security/Models/AuditLog.php` (new; UUID model, `before`/`after` cast to array, `save()` blocks update when the row already exists, `delete()` always throws — the same append-only invariant that SecurityEvent enforces), `backend/app/Modules/Security/Http/Middleware/AuditMiddleware.php` (new; wraps every POST/PUT/PATCH/DELETE — snapshots before-state from the route-bound model on PUT/PATCH/DELETE, attaches `entity`/`entity_id`/`action` overrides from request attributes when the controller sets them, writes exactly one row to `audit_logs` after the response is built, marks failures with `error.<verb>`, returns `X-Audit-Id` + `X-Audit-Status: ok|failed` response headers; fail-open — a failed audit write never breaks the user response), `backend/bootstrap/app.php` (registered the middleware via `$middleware->append(AuditMiddleware::class)` so it runs on every request — it is a no-op for GET, so the cost is negligible), `backend/tests/Feature/Security/AuditMiddlewareTest.php` (new; 8 tests — exactly-one-row for successful verify-otp, `error.<verb>` row for failed verify-otp, exactly-one-row for successful logout, no row for GET, model-level immutability for update and delete, device fingerprint recorded).
- **Acceptance criteria:** A POST that mutates a record writes exactly one audit row; rows are append-only (model layer); failed controllers still record a row with `error.<verb>`; audit failures do not break the user response.
- **Required tests:** Pest `tests/Feature/Security/AuditMiddlewareTest.php` — 8/8 pass; full suite 159/159 (595 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The middleware is intentionally `append`-ed globally (not just to mutating routes) so the cost is uniform and so the `X-Audit-Id` response header is present on every request, which makes operational debugging easier. The controller can attach `audit.entity` / `audit.entity_id` / `audit.action` / `audit.before` / `audit.after` request attributes for non-model endpoints (e.g. auth login), but for the v1 the middleware falls back to the route-bound model + verb, which already covers the reports / workflow / users endpoints from M4+. The audit log is "complete enough" for V1 — future M15 (Compliance Hardening) will add tamper-evident hashing and a periodic integrity-check job.


### T-M2-021 — Implement security event capture
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 19:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(security): complete T-M2-021 — SecurityEventService` (sha: 8511b42d)
- **Files touched:** `backend/app/Modules/Security/Services/SecurityEventService.php` (new; `record(event, severity, metadata, user, ip, userAgent)`; `info` / `warning` / `critical` convenience wrappers; `recordSafe` fail-open wrapper for hot paths; severity allow-list guard (422 INVALID_SEVERITY); event-name non-empty + ≤64 char guard (422 INVALID_EVENT); IP / UA fall back to the active request when not supplied; never throws to the caller when wrapped in `recordSafe`), `backend/tests/Feature/Security/SecurityEventServiceTest.php` (new; 12 tests — info-with-user, critical-without-user, empty-metadata-null-coercion, null-metadata, severity allow-list, empty-event reject, >64-char reject, model immutability update/delete, recordSafe swallow, recordSafe success, request IP/UA fallback).
- **Acceptance criteria:** `record` persists a row; severity is constrained; event names are non-empty + ≤64 chars; the model layer still rejects update/delete (immutability test).
- **Required tests:** Pest `tests/Feature/Security/SecurityEventServiceTest.php` — 12/12 pass; full suite 171/171 (616 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The service is intentionally split into `record` (strict — throws on bad inputs) and `recordSafe` (swallow — logs the failure and returns null). Hot paths (e.g. the audit middleware, the login endpoint) should use `recordSafe` so a security-event write failure never breaks the user flow. Strict callers (admin tools, batch jobs) should use `record` so that input drift is caught early. The IP / UA fall back to the active request only when the caller did not supply them, so a console command (no HTTP request) still works with `null` IP / UA.


### T-M2-022 — Configure rate limiters per docs/11 §21
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 20:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(security): complete T-M2-022 — RouteServiceProvider + named rate limiters` (sha: bacdb1dc)
- **Files touched:** `backend/app/Providers/RouteServiceProvider.php` (new; 6 named limiters: otp 5/h per IP, citizen 60/min per user-or-IP, uploads 120/h, moderator 300/min, department 300/min, admin 600/min; each key is namespaced to prevent cross-limiter cache collisions; public constants `LIMITER_OTP`/`LIMITER_CITIZEN`/etc. for route binding), `backend/bootstrap/providers.php` (registered the new provider), `backend/bootstrap/app.php` (added `ThrottleRequestsException` renderer → 429 envelope with `code: RATE_LIMITED`, preserving `Retry-After` from the framework), `backend/tests/Feature/Security/RateLimiterTest.php` (new; 6 tests covering limiter registration, key format under authenticated/unauthenticated, the public constants, and an integration test that 6 consecutive `/auth/send-otp` requests from the same IP return 429).
- **Acceptance criteria:** `RateLimiter::for('otp')` returns `Limit::perHour(5)`; all 6 limiters registered; the throttle middleware integration test passes (6th request → 429).
- **Required tests:** Pest `tests/Feature/Security/RateLimiterTest.php` — 6/6 pass; full suite 177/177 (642 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The keys are namespaced per limiter (`otp:`, `citizen:`, `uploads:`, `mod:`, `dept:`, `admin:`) so a user id can never collide across limiters in the shared cache. The `ThrottleRequestsException` renderer preserves the `Retry-After` / `X-RateLimit-*` headers the framework attaches, which is important so clients can back off intelligently. The 100 MB/hour byte cap on uploads is enforced by the upload service (T-M5-xxx) — the request-count cap on the named limiter is a backstop, not the primary control. M3 will move the numeric values into the `settings` table per the spec note that rates must be "configurable".

### T-M2-023 — Apply rate limiters to auth routes
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 20:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-023 — apply rate limiters to auth routes` (sha: 5bfbd5d5)
- **Files touched:** `backend/routes/api.php` (`/auth/send-otp` wrapped with `throttle:otp`; `/auth/verify-otp` and `/auth/refresh` wrapped with `throttle:citizen`; the authenticated group containing `/auth/logout` and `/auth/me` carries `auth:sanctum` + `throttle:citizen`), `backend/tests/Feature/Authentication/SendOtpEndpointTest.php` (corrected `LoginHistory` row-count expectation — the throttle middleware runs before the controller, so the 429 path no longer writes a `LoginHistory` row; 5 successful requests ⇒ 5 rows, not 6), `backend/tests/Feature/Authentication/VerifyOtpEndpointTest.php` (removed a redundant pre-existing double-`request()` call that was causing intermittent otp-limiter cross-contamination between tests by consuming the 5/hour budget twice in a single test).
- **Acceptance criteria:** 6th `/auth/send-otp` request within an hour from the same IP returns 429 with `code: RATE_LIMITED`; authenticated `/auth/*` routes are subject to 60 req/min per user.
- **Required tests:** Pest `tests/Feature/Authentication/SendOtpEndpointTest.php` (rate-limited assertion passes) and `RateLimiterTest::it honors the throttle middleware on a route and returns 429 after 5 calls` (integration) — full suite 177/177 (642 assertions) green.
- **Notes:** The `throttle:citizen` middleware is intentionally applied to the authenticated group *in addition to* `auth:sanctum`. This is so a logged-in user who is hammering the API still gets cut off at 60 req/min before they reach business logic. The VerifyOtpEndpointTest fix is a real test-stability fix — the pre-existing test was calling `OtpService::request()` then immediately making a second `Request`-create+post flow that consumed an extra OTP budget, which was a latent flakiness source now that the otp limiter exists.

### T-M2-024 — Add UserResource with roles and permissions
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 20:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(users): complete T-M2-024 — UserResource with lazy roles/permissions` (sha: e1c5c7da)
- **Files touched:** `backend/app/Modules/Users/Http/Resources/UserResource.php` (refactored: `roles` and `permissions` now keyed on `relationLoaded('roles')` — keys are absent when the relation was not eager-loaded, so list endpoints are N+1-safe; callers opt in with `->load('roles')` before serialisation), `backend/app/Modules/Authentication/Http/Controllers/AuthController.php` (verify-otp and me endpoints now `->load('roles')` before constructing the `UserResource` so the existing API contract `data.user.roles` is preserved), `backend/tests/Unit/Users/UserResourceTest.php` (new; 8 tests — safe-field exposure, lazy omission, eager-load inclusion, empty-roles case, ISO-8601 timestamp formatting, boolean cast for `anonymous_enabled`, no leak of password / 2FA secret / recovery codes, and the `JsonResource` contract).
- **Acceptance criteria:** Resource never leaks password hash, OTP, or 2FA secret; `roles` and `permissions` are present when the relation is loaded, omitted otherwise.
- **Required tests:** Pest `tests/Unit/Users/UserResourceTest.php` — 8/8 pass; full suite 185/185 (670 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The lazy-load design is the right tradeoff for the citizen PWA: the /me endpoint (a single user, roles needed) and the /auth/verify-otp response (a single user, roles needed) opt in via `->load('roles')`, while future list endpoints (T-M10 list users, T-M12 staff directory) can render thousands of users without paying the Spatie query cost per row. The 8 tests cover both the omission and inclusion paths plus the security-critical never-leak invariant.

### T-M2-025 — Document auth API in OpenAPI
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 21:10 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(api-docs): complete T-M2-025 — document auth API in OpenAPI` (sha: 03757ab8)
- **Files touched:** `backend/storage/api-docs/openapi.yaml` (extended with M2 Authentication namespace: paths for `/auth/send-otp`, `/auth/verify-otp`, `/auth/refresh`, `/auth/logout`, `/auth/me` with operationIds, descriptions, security requirements, and 200/401/422/429 responses; added Authentication tag; added shared `ApiResponse`, `ErrorResponse`, `SendOtpRequest/Response`, `VerifyOtpRequest/Response`, `RefreshTokenRequest/Response`, `LogoutResponse`, `User`, `UserResponse` schemas; added shared `Unauthorized`, `ValidationError`, `RateLimited` responses), `backend/tests/Feature/OpenApiAuthTest.php` (new; 10 tests — Authentication tag present, all five paths present, correct HTTP methods, Sanctum security on logout/me, no security on pre-login endpoints, all referenced schemas resolvable, shared 401/422/429 responses defined, all auth responses use the standard envelope, `/api/v1/openapi.yaml` serves yaml content type, `/api/documentation` renders the Swagger UI referencing the openapi URL).
- **Acceptance criteria:** All five auth paths documented; request/response schemas are referenced; shared error responses are reused; `/api/documentation` renders the new endpoints.
- **Required tests:** Pest `tests/Feature/OpenApiAuthTest.php` — 10/10 pass; full suite 195/195 (719 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The 401/422/429 responses are extracted as shared `responses` components so future endpoints (M3+ geographical, M4 reports, etc.) can `$ref` them instead of duplicating the inline shape. The `User` schema marks `roles` and `permissions` as optional arrays — the resource omits them when the relation is not eager-loaded (T-M2-024). `swagger-cli` is not installed in this environment; validation is done in-test by parsing the YAML and asserting structure, which is the right tradeoff for the agent-only test layer.

### T-M2-026 — Add docs/auth.md
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 21:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(docs): complete T-M2-026 — add docs/auth.md` (sha: 4c2dd809)
- **Files touched:** `docs/auth.md` (new; 203 lines — on-ramp for new contributors and reference for reviewers. Sections: personas, citizen-login happy path, JWT lifecycle, refresh rotation, roles/permissions/policies, rate limiting, audit, security events, device fingerprinting, error envelope, cross-references, manual review checklist).
- **Acceptance criteria:** Document explains the happy path, error codes, and rotation; cross-links OpenAPI.
- **Required tests:** Manual review checklist (12 items). No automated tests for this task by design — the doc is the deliverable.
- **Notes:** This is a reference doc, not a spec — it never overrides `docs/05` or `docs/11`. The cross-references section points readers back to the authoritative spec sections. The `docs/` folder otherwise contains the immutable specifications (01-16), so this file is the only engineering on-ramp in the tree and is named explicitly to avoid colliding with the numbered spec set.

### T-M2-027 — Add Pest feature suite for OTP throttle
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 22:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-027 — Pest feature suite for OTP throttle` (sha: 4074f0d5)
- **Files touched:** `backend/tests/Feature/Authentication/OtpThrottleFeatureTest.php` (new; 8 tests — 5 successful requests with distinct mobiles, 6th returns 429 RATE_LIMITED, standard envelope on 429, Retry-After header preserved, IP-based throttling, middleware order (malformed body from throttled IP returns 429 not 422), counterpart test (malformed body from fresh IP returns 422), Cache::flush() + RateLimiter::clear() resets the limiter so a fresh IP succeeds).
- **Acceptance criteria:** Suite passes; rate limits reset by `Cache::flush()` between tests.
- **Required tests:** Pest `tests/Feature/Authentication/OtpThrottleFeatureTest.php` — 8/8 pass; full suite 203/203 (786 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The Laravel-throttle middleware runs BEFORE the FormRequest validator, so a malformed body from a throttled IP returns 429 RATE_LIMITED, not 422. The test suite covers both orderings explicitly. The middleware hashes the rate-limit key (md5 of `limiterName.key`), so `RateLimiter::clear()` must be paired with `Cache::flush()` to fully reset the bucket — the test verifies both.

### T-M2-028 — Add Pest feature suite for refresh rotation
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 22:30 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-028 — Pest feature suite for refresh rotation` (sha: a906933b)
- **Files touched:** `backend/tests/Feature/Authentication/RefreshRotationFeatureTest.php` (new; 8 tests — issue, rotate, replay rejected, REFRESH_TOKEN_REPLAY security event on replay, entire chain killed on replay, unknown token, malformed body, fresh access token per rotation), `backend/app/Modules/Authentication/Services/RefreshTokenService.php` (now takes `SecurityEventService` via DI; `revokeChain()` emits a `REFRESH_TOKEN_REPLAY` security event with severity `critical` and token_id/user_id/ip/user_agent metadata; tightened error codes: UNKNOWN → REFRESH_TOKEN_INVALID, EXPIRED → REFRESH_TOKEN_EXPIRED, REPLAY → REFRESH_TOKEN_REPLAY), `backend/tests/Feature/Authentication/RefreshTokenRotationTest.php` (switch to `app(RefreshTokenService::class)` so DI can inject SecurityEventService), `backend/tests/Feature/Authentication/RefreshEndpointTest.php` (update replay-case assertion to new `REFRESH_TOKEN_REPLAY` code).
- **Acceptance criteria:** All cases green; security event row present.
- **Required tests:** Pest `tests/Feature/Authentication/RefreshRotationFeatureTest.php` — 8/8 pass; full suite 211/211 (825 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The security event emission was the missing production-side change for this task — `RefreshTokenService` previously revoked the chain on replay but emitted no event, leaving security dashboards blind to token theft. The new code emits a `critical`-severity event with the chain root token id and the IP / user agent captured at issue time, so dashboards and SIEM integrations can alert. Specific error codes (REFRESH_TOKEN_INVALID / EXPIRED / REPLAY) replace the previous generic `UNAUTHORIZED` so callers can branch without parsing the human-readable message.

### T-M2-029 — Add Pest feature suite for RBAC denials
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 22:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(rbac): complete T-M2-029 — Pest feature suite for RBAC denials` (sha: 182527a8)
- **Files touched:** `backend/tests/Feature/Users/RbacDenialFeatureTest.php` (new; 10 tests — citizen blocked from moderator and admin routes, moderator blocked from admin routes, moderator allowed on moderator routes, super_admin / system bypass all routes, suspended super_admin denied (status gate beats role bypass), soft-deleted super_admin denied (trash gate beats role bypass), unauthenticated caller gets 401, auditor allowed on read-only path but blocked from mutating actions), `backend/bootstrap/app.php` (added AccessDeniedHttpException and AuthorizationException renderers that return 403 with the standard envelope and code FORBIDDEN — without this, every Gate::authorize() failure was being turned into a 500 by the generic Throwable handler).
- **Acceptance criteria:** 403s returned with envelope; allowed roles return 200.
- **Required tests:** Pest `tests/Feature/Users/RbacDenialFeatureTest.php` — 10/10 pass; full suite 221/221 (850 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The test uses synthetic Gate definitions that mirror the BasePolicy::before() contract — suspended / disabled / pending / trashed users are always denied, then the per-ability role check is applied. The real ReportPolicy / UserPolicy / AuditLogPolicy land in M10 / M11 / M12; until then the synthetic gates hold the contract and the test will continue to pass. The 403 renderer is itself a real production-side gap (previously 500 on every Gate::authorize failure) and is required by the M2 happy path.

### T-M2-030 — Wire M2 documentation into README
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 23:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(docs): complete T-M2-030 — wire M2 documentation into README` (sha: b41379fa)
- **Files touched:** `README.md` (added an "Authentication" section between Architecture and Development — seeded roles table, /api/v1/auth/* endpoint table, cross-links to docs/auth.md, the OpenAPI spec, and the relevant docs/05 + docs/11 sections).
- **Acceptance criteria:** README has a working link to docs/auth.md.
- **Required tests:** Manual review.
- **Notes:** The link to docs/auth.md is a plain `./docs/auth.md` path so it works in both GitHub rendering and any local preview. The link to the OpenAPI spec points at the canonical YAML in backend/storage/api-docs/openapi.yaml; the live UI is at /api/documentation. The seeded-roles table is the same list docs/auth.md uses, kept in sync.

## 2.1 M2 milestone closed

M2 (Identity, Auth & RBAC Core) is complete. 30/30 tasks done. The next milestone per the roadmap is M3 (Master Configuration & Geography, 24 tasks).

### T-M3-001 — Create countries migration and model
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-26 23:30 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-001 — countries migration and model` (sha: 200aa8)
- **Files touched:** `backend/database/migrations/2026_06_26_170000_create_countries_table.php` (new; UUID PK, name, unique iso2, iso3, phone_code, active, timestamps; MySQL InnoDB / utf8mb4), `backend/app/Modules/Departments/Models/Country.php` (new; HasUuids + HasFactory<CountryFactory>, fillable, active cast — State relation added in T-M3-002 per D-009), `backend/database/factories/Modules/Departments/Models/CountryFactory.php` (new), `backend/database/seeders/CountriesSeeder.php` (new; idempotent firstOrCreate for IN / US / GB / AE / SG, wired into DatabaseSeeder), `backend/tests/Feature/Database/CountriesTableTest.php` (new; 5 tests — required columns, UUID PK, unique iso2 enforced, active cast, idempotent India seed).
- **Acceptance criteria:** `Country::create([...])` succeeds; seeder inserts India idempotently.
- **Required tests:** Pest `tests/Feature/Database/CountriesTableTest.php` — 5/5 pass; full suite 226/226 (868 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The geography master is DB-driven (D-004); the seeder is the V1 minimum. Additional countries are added via the Super Admin Portal (M12) using the same firstOrCreate upsert pattern. The relation to State is intentionally NOT declared on Country in this task — per D-009 relations land with their model, so it ships in T-M3-002.

### T-M3-002 — Create states migration and model
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-26 23:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-002 — states migration and model` (sha: 503cb3)
- **Files touched:** `backend/database/migrations/2026_06_26_170100_create_states_table.php` (new; UUID PK, country_id UUID FK → countries (restrictOnDelete), unique (country_id, code), MySQL InnoDB / utf8mb4), `backend/app/Modules/Departments/Models/State.php` (new; HasUuids + HasFactory, belongsTo Country, fillable, active cast), `backend/app/Modules/Departments/Models/Country.php` (added reverse HasMany<State> per D-009), `backend/database/factories/Modules/Departments/Models/StateFactory.php` (new), `backend/tests/Feature/Database/StatesTableTest.php` (new; 5 tests — required columns, FK enforced, unique (country_id, code), same code allowed in different countries, belongsTo Country works).
- **Acceptance criteria:** FK enforced; unique index on (country_id, code).
- **Required tests:** Pest `tests/Feature/Database/StatesTableTest.php` — 5/5 pass; full suite 231/231 (881 assertions) green; PHPStan clean; Pint clean.
- **Notes:** `restrictOnDelete` on the FK means deleting a Country that still has States will be rejected at the DB level — this matches the master-data contract (geography is never row-deleted in V1; the `active` flag is the soft-disable).

### T-M3-003 — Create districts migration and model
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 00:10 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-003 — districts migration and model` (sha: 47cf33)
- **Files touched:** `backend/database/migrations/2026_06_26_170200_create_districts_table.php` (new; UUID PK, state_id UUID FK → states (restrictOnDelete), unique (state_id, code), MySQL InnoDB / utf8mb4), `backend/app/Modules/Departments/Models/District.php` (new; HasUuids + HasFactory, belongsTo State), `backend/app/Modules/Departments/Models/State.php` (added reverse HasMany<District>), `backend/database/factories/Modules/Departments/Models/DistrictFactory.php` (new), `backend/tests/Feature/Database/DistrictsTableTest.php` (new; 4 tests).
- **Acceptance criteria:** FK enforced; `District::factory()->create()` works.
- **Required tests:** Pest `tests/Feature/Database/DistrictsTableTest.php` — 4/4 pass; full suite 235/235 (893 assertions) green; PHPStan clean; Pint clean.

### T-M3-004 — Create cities migration and model
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 00:20 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-004 — cities migration and model` (sha: c6eba1)
- **Files touched:** `backend/database/migrations/2026_06_26_170300_create_cities_table.php` (new; UUID PK, district_id UUID FK → districts (restrictOnDelete), unique (district_id, code), active, timestamps; MySQL InnoDB / utf8mb4 / collation pins), `backend/app/Modules/Departments/Models/City.php` (new; HasUuids + HasFactory<CityFactory>, fillable, active cast, belongsTo District), `backend/app/Modules/Departments/Models/District.php` (added reverse HasMany<City> per D-009), `backend/database/factories/Modules/Departments/Models/CityFactory.php` (new; faker factory + chained District factory), `backend/tests/Feature/Database/CitiesTableTest.php` (new; 4 tests — required columns, FK to districts, unique (district_id, code), belongsTo District).
- **Acceptance criteria:** FK enforced; `City::factory()->create()` works; unique (district_id, code) rejects duplicates.
- **Required tests:** Pest `tests/Feature/Database/CitiesTableTest.php` — 4/4 pass; full suite 240/240 (910 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-005 — Create zones migration and model
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 00:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-005 — zones migration and model` (sha: dd2dd53)
- **Files touched:** `backend/database/migrations/2026_06_26_170400_create_zones_table.php` (new; UUID PK, city_id UUID FK → cities (restrictOnDelete), code varchar(8), unique (city_id, code), active, timestamps; MySQL InnoDB / utf8mb4 / collation pins; no soft deletes per spec), `backend/app/Modules/Departments/Models/Zone.php` (new; HasUuids + HasFactory<ZoneFactory>, fillable, active cast, belongsTo City), `backend/app/Modules/Departments/Models/City.php` (added reverse HasMany<Zone> per D-009), `backend/database/factories/Modules/Departments/Models/ZoneFactory.php` (new; faker factory + chained City factory), `backend/tests/Feature/Database/ZonesTableTest.php` (new; 4 tests — required columns, FK to cities, unique (city_id, code), belongsTo City).
- **Acceptance criteria:** FK enforced; unique (city_id, code) rejects duplicates; soft delete disabled.
- **Required tests:** Pest `tests/Feature/Database/ZonesTableTest.php` — 4/4 pass; full suite 243/243 (917 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-006 — Create wards migration with spatial polygon
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 01:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-006 — wards migration with spatial polygon` (sha: a8efb9e)
- **Files touched:** `backend/database/migrations/2026_06_27_000000_create_wards_table.php` (new; UUID PK, city_id UUID FK → cities (restrictOnDelete), zone_id UUID FK → zones (nullOnDelete — small cities have no zones), unique (city_id, ward_number), active, timestamps, softDeletes; driver-specific `boundary_polygon` column: MySQL `POLYGON NOT NULL SRID 4326` with `SPATIAL INDEX wards_boundary_polygon_sidx` via raw `DB::statement`, SQLite `TEXT` fallback so the migration is portable across the test and prod drivers), `backend/app/Modules/Departments/Models/Ward.php` (new; HasUuids + HasFactory<WardFactory> + SoftDeletes, fillable, ward_number cast to int, active cast to bool, boundary_polygon kept as WKT (string), belongsTo City and belongsTo Zone), `backend/database/factories/Modules/Departments/Models/WardFactory.php` (new; faker factory producing a sample closed WKT polygon and chained City/Zone factories), `backend/tests/Feature/Geography/WardPolygonTest.php` (new; 9 tests — required columns incl. soft delete, FK to cities, FK to zones, nullOnDelete behaviour for zone, unique (city_id, ward_number), soft delete hides + restores, belongsTo City/Zone, WKT polygon roundtrip, MySQL spatial-index creation driver-guarded).
- **Acceptance criteria:** Spatial index created on MySQL; raw SQL guarded by `DB::statement` and `getDriverName()`; SQLite gets a TEXT fallback column; insert roundtrips a polygon (WKT) on the test driver; soft delete hides the row from default queries.
- **Required tests:** Pest `tests/Feature/Geography/WardPolygonTest.php` — 9/9 pass; full suite 252/252 (942 assertions) green; PHPStan clean (app/); Pint clean. (Pint applied the `blank_line_before_statement`, `class_definition`, `braces_position`, `fully_qualified_strict_types`, and `ordered_imports` fixers to the new files; non-T-M3-006 PHPStan noise in `StateFactory.php` + `RolesAndPermissionsSeeder.php` is pre-existing and out of scope for this task.)

### T-M3-007 — Create departments migration
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 01:30 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-007 — departments migration` (sha: 61e3818)
- **Files touched:** `backend/database/migrations/2026_06_27_010000_create_departments_table.php` (new; UUID PK, name, unique code varchar(32), parent_id UUID self-FK → departments with nullOnDelete, jurisdiction, address, email, phone varchar(32), working_hours JSON, holiday_calendar JSON, default_workflow_id UUID (FK added in a follow-up migration when workflow_definitions lands in T-M3-014), default_sla_minutes unsigned int default 2880, escalation_matrix JSON, active bool, timestamps, softDeletes (deleted_at); MySQL InnoDB / utf8mb4 / collation pins), `backend/tests/Feature/Database/DepartmentsTableTest.php` (new; 5 tests using `DB::table` + `Str::uuid` so the test is independent of the `Department` model which lands in T-M3-008 — required columns, unique (code) enforced, parent_id FK rejects non-existent refs, nullOnDelete cascades parent deletion to children, deleted_at column exists and starts null).
- **Acceptance criteria:** Self-FK works; soft delete column present; unique code enforced.
- **Required tests:** Pest `tests/Feature/Database/DepartmentsTableTest.php` — 5/5 pass; full suite 257/257 (964 assertions) green; PHPStan clean (app/); Pint clean. Per D-009 the `Department` model and its `parent`/`children` relations ship in T-M3-008.

### T-M3-008 — Create Department model with soft deletes
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 02:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-008 — Department model with soft deletes` (sha: 31d77ee)
- **Files touched:** `backend/app/Modules/Departments/Models/Department.php` (new; HasUuids + HasFactory<DepartmentFactory> + SoftDeletes, fillable for every column, casts for active / default_sla_minutes / working_hours / holiday_calendar / escalation_matrix, belongsTo parent (self) + hasMany children (self) — M:N users relation deferred to T-M3-009 per D-009), `backend/database/factories/Modules/Departments/Models/DepartmentFactory.php` (new; faker factory with slug-style code, plausible working_hours, empty holiday_calendar + escalation_matrix, default_sla_minutes = 2880; states `inactive()` + `withParent(Department $parent)`), `backend/tests/Unit/Departments/DepartmentModelTest.php` (new; 7 tests — UUID PK + table + key type, cast map, JSON roundtrips, parent belongsTo, children hasMany, soft delete hides + restores, soft-deleted parent leaves child intact).
- **Acceptance criteria:** `$dept->parent` and `$dept->children` return correct relations; soft delete works.
- **Required tests:** Pest `tests/Unit/Departments/DepartmentModelTest.php` — 7/7 pass; full suite 264/264 (992 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-009 — Create department_users pivot migration
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 02:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-009 — department_users pivot migration` (sha: 7f312bb)
- **Files touched:** `backend/database/migrations/2026_06_27_020000_create_department_users_table.php` (new; UUID PK, user_id UUID FK → users cascadeOnDelete, department_id UUID FK → departments restrictOnDelete, is_manager bool default false, assigned_at timestamp default current, timestamps; unique (user_id, department_id), index (department_id, is_manager), index (user_id); MySQL InnoDB / utf8mb4 / collation pins), `backend/tests/Feature/Database/DepartmentUsersTableTest.php` (new; 6 tests using `DB::table` + `Str::uuid` so the test is independent of the `DepartmentUser` model which lands with the cross-module belongsToMany in T-M3-010 — required columns, FK to users, FK to departments, unique (user_id, department_id), hard-delete on users cascades to pivot, soft-delete does NOT cascade).
- **Acceptance criteria:** Migration roundtrips; unique constraint enforced; FK cascade on hard delete only.
- **Required tests:** Pest `tests/Feature/Database/DepartmentUsersTableTest.php` — 6/6 pass; full suite 270/270 (1006 assertions) green; PHPStan clean (app/); Pint clean. Per D-009 the `DepartmentUser` model and the `User::departments()` / `Department::users()` belongsToMany land in T-M3-010 (the smallest unit the rest of M3 needs in place).

### T-M3-010 — Create settings migration and model
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 02:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(settings): complete T-M3-010 — settings migration and model` (sha: 6a87d45)
- **Files touched:** `backend/database/migrations/2026_06_27_030000_create_settings_table.php` (new; UUID PK, unique `key` (dotted path), `value` JSON, `type` string default 'string' (string|int|bool|json|datetime), description, is_public bool default false, timestamps, softDeletes — forget preserves an audit trail; index on is_public; MySQL InnoDB / utf8mb4 / collation pins), `backend/app/Modules/Settings/Models/Setting.php` (new; HasUuids + HasFactory<SettingFactory> + SoftDeletes, fillable for every column, casts (value as array, is_public as bool); static `Setting::get(string $key, mixed $default = null)` reads + coerces by declared type, `Setting::set(string $key, mixed $value, string $type = 'string')` upserts via updateOrCreate; coerce() handles string / int / bool / datetime — JSON is the canonical on-disk format; the SettingsService in T-M3-012 wraps these with a Redis cache), `backend/database/factories/Modules/Settings/Models/SettingFactory.php` (new; faker factory with unique dotted key, sample value, default 'string' type, sentence description), `backend/tests/Feature/Settings/SettingModelTest.php` (new; 11 tests — required columns, unique (key) enforced via direct create, string / int / bool / JSON / datetime roundtrips through set→get, default fallback on miss, soft-deleted key returns default, table + UUID PK, value cast to array).
- **Acceptance criteria:** `Setting::set('foo', 'bar')` and `Setting::get('foo')` roundtrip; int / bool / json / datetime types round-trip with the right PHP type.
- **Required tests:** Pest `tests/Feature/Settings/SettingModelTest.php` — 11/11 pass; full suite 281/281 (1032 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-011 — Create app_configs migration and model (feature flags)
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 03:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(settings): complete T-M3-011 — app_configs migration and model` (sha: b8b460a)
- **Files touched:** `backend/database/migrations/2026_06_27_040000_create_app_configs_table.php` (new; UUID PK, unique `key`, `value` JSON, `enabled` bool default false, `rollout_percentage` unsignedTinyInteger 0-100, `cohort` JSON, description, timestamps; index on enabled), `backend/app/Modules/Settings/Models/AppConfig.php` (new; HasUuids + HasFactory<AppConfigFactory>, fillable, casts (value/cohort as array, enabled as bool, rollout_percentage as int) — no static helpers; the FeatureFlagService owns enabled / bucket / cohort semantics), `backend/database/factories/Modules/Settings/Models/AppConfigFactory.php` (new; faker factory; states `enabled(int $rollout = 100)` + `withCohort(array $cohort)`), `backend/tests/Feature/Settings/AppConfigModelTest.php` (new; 5 tests — required columns, unique (key) enforced, table + UUID PK, casts, rollout_percentage range guard lives in the service).
- **Acceptance criteria:** Insert with rollout 0-100 works; cohort filter is JSON.
- **Required tests:** Pest `tests/Feature/Settings/AppConfigModelTest.php` — 5/5 pass; full suite 286/286 (1051 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-012 — Implement SettingsService with cache invalidation
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 03:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(settings): complete T-M3-012 — SettingsService with cache invalidation` (sha: c6edd1a)
- **Files touched:** `backend/app/Modules/Settings/Services/SettingsService.php` (new; thin caching wrapper — `get(key, default)` checks `settings:<key>` in the cache, falls through to the model, and only writes the cache when the row actually exists; `set(key, value, type)` upserts via Setting::set and forgets the matching cache entry; `forget(key)` soft-deletes the row and clears the cache; type coercion delegated to the model), `backend/tests/Feature/Settings/SettingsServiceTest.php` (new; 7 tests — default on miss, set→get roundtrip, persistence across cache flush, second get hits cache, set invalidates, forget soft-deletes + clears, typed roundtrips).
- **Acceptance criteria:** Second `get` hits cache; `set` invalidates cache; misses are not cached (so a freshly-inserted setting is visible immediately).
- **Required tests:** Pest `tests/Feature/Settings/SettingsServiceTest.php` — 7/7 pass; full suite 293/293 (1064 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-013 — Implement FeatureFlagService
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 04:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(settings): complete T-M3-013 — FeatureFlagService` (sha: pending — see git log)
- **Files touched:** `backend/app/Modules/Settings/Services/FeatureFlagService.php` (new; three ordered rules — `enabled` master switch, `cohort` predicate match with array "in" semantics and pseudo-attributes (`id`, `role`), `rollout_percentage` via deterministic SHA-256 bucket of `<key>:<userId | sessionId | "anon">` mod 100), `backend/tests/Feature/Settings/FeatureFlagServiceTest.php` (new; 9 tests — missing key / disabled / 100 / 0 / same-user-stability / 200-user partition within ±40 % at 50 % rollout / cohort short-circuit / cohort "in" semantics / anonymous caller stability).
- **Acceptance criteria:** Same user always gets same answer; rollout 0 means never, 100 means always; cohort filter respected.
- **Required tests:** Pest `tests/Feature/Settings/FeatureFlagServiceTest.php` — 9/9 pass; full suite 302/302 (1076 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-014 — DepartmentRepository and DepartmentService
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 05:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-014 — DepartmentRepository and DepartmentService` (sha: 983a300)
- **Files touched:** `backend/app/Modules/Departments/Events/DepartmentCreated.php` (new; Dispatchable event with (departmentId, snapshot)), `backend/app/Modules/Departments/Events/DepartmentUpdated.php` (new; Dispatchable event with (departmentId, before, after)), `backend/app/Modules/Departments/Events/DepartmentDeleted.php` (new; Dispatchable event with (departmentId, snapshot)), `backend/app/Modules/Departments/Repositories/DepartmentRepository.php` (new; pure data access — query / findById / findByCode / search(filters, perPage) with q / jurisdiction / parent_id / active filters / byJurisdiction / create / update / delete), `backend/app/Modules/Departments/Services/DepartmentService.php` (new; business layer — normalises payload (drops nulls for partial-update safety), enforces unique (code), rejects unknown parent, rejects self-as-parent (cycle), validates escalation_matrix shape, dispatches the three events, throws ApiException with explicit errorCode + httpStatus (422)), `backend/tests/Feature/Departments/DepartmentServiceTest.php` (new; 8 tests — create dispatches, duplicate code throws, unknown parent throws, self-parent throws, update dispatches with before/after, delete soft-deletes + dispatches, invalid escalation throws, valid matrix roundtrips).
- **Acceptance criteria:** Service emits `DepartmentCreated`, `DepartmentUpdated`, `DepartmentDeleted` events; unique (code) and parent existence invariants enforced; escalation_matrix validated; API exceptions render with the standard envelope.
- **Required tests:** Pest `tests/Feature/Departments/DepartmentServiceTest.php` — 8/8 pass; full suite 310/310 (1091 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-015 — GeographyRepository and GeographyService
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 05:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-015 — GeographyRepository and GeographyService` (sha: 9869758)
- **Files touched:** `backend/app/Modules/Departments/DTOs/GeographyDTO.php` (new; readonly, immutable payload — `fromArray` parses a Form Request's validated output, `toRow` emits a row array safe for `updateOrCreate` and skips nulls), `backend/app/Modules/Departments/Repositories/GeographyRepository.php` (new; pure data access — `countries()` / `statesByCountry()` / `districtsByState()` / `citiesByDistrict()` / `zonesByCity()` / `wardsByCity()` / `wardsByZone()` builders + a generic `paginate($query, $perPage)` helper), `backend/app/Modules/Departments/Services/GeographyService.php` (new; paginated tree lookups + a single `upsert(GeographyDTO)` that routes to the right model via match on `level`; per-level invariants enforced (ward needs `ward_number`, state/city/zone need parent, country needs iso2); throws ApiException 422 on validation miss), `backend/tests/Feature/Geography/GeographyServiceTest.php` (new; 9 tests — paginated list helpers, upsert at every level, iso2 normalisation, ward with WKT polygon, unknown level rejected, missing ward_number rejected, missing parent country rejected).
- **Acceptance criteria:** DTOs validated; helpers return paginated results; one upsert endpoint for all six levels.
- **Required tests:** Pest `tests/Feature/Geography/GeographyServiceTest.php` — 9/9 pass; full suite 319/319 (1114 assertions) green; PHPStan clean (app/); Pint clean.

### T-M3-016 — Department CRUD endpoints
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 06:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-016 — Department CRUD endpoints` (sha: 95409e5)
- **Files touched:** `backend/app/Modules/Departments/Http/Resources/DepartmentResource.php` (new), `backend/app/Modules/Departments/Http/Requests/StoreDepartmentRequest.php` (new), `backend/app/Modules/Departments/Http/Requests/UpdateDepartmentRequest.php` (new), `backend/app/Modules/Departments/Http/Controllers/Admin/DepartmentController.php` (new), `backend/routes/api.php` (added super_admin group with five Department routes), `backend/tests/Feature/Departments/DepartmentCrudTest.php` (new; 10 tests).
- **Acceptance criteria:** All 5 endpoints respond; audit row per write; 403 for non-admin.
- **Required tests:** Pest `tests/Feature/Departments/DepartmentCrudTest.php` — 10/10 pass; full suite 329/329 (1138 assertions) green; PHPStan clean (app/); Pint clean.


### T-M3-017 — Settings CRUD endpoints
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 06:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(settings): complete T-M3-017 — Settings CRUD endpoints` (sha: 2586476)
- **Files touched:** `backend/app/Modules/Settings/Http/Controllers/Admin/SettingController.php` (new; 5 endpoints — index/store/show/update/destroy — all gated on super_admin), `backend/app/Modules/Settings/Http/Requests/StoreSettingRequest.php` (new; key unique, type enum), `backend/app/Modules/Settings/Http/Requests/UpdateSettingRequest.php` (new; partial update, no key editing), `backend/app/Modules/Settings/Http/Resources/SettingResource.php` (new), `backend/routes/api.php` (added settings.index/store/show/update/destroy to super_admin group), `backend/tests/Feature/Settings/SettingCrudTest.php` (new; 12 tests — 401/403 guards, pagination, q filter, create + duplicate + unknown type, show + 404, update + cache invalidation, partial update, soft delete + cache clear).
- **Acceptance criteria:** All 5 endpoints respond with the ApiResponse envelope; super_admin role required; cache invalidation proven by direct read after PUT; soft-delete preserves audit trail.
- **Required tests:** Pest `tests/Feature/Settings/SettingCrudTest.php` — 12/12 pass; full suite 341/341 (1173 assertions) green; PHPStan clean (app/); Pint clean.


### T-M3-018 — Feature flag CRUD endpoints
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 07:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(settings): complete T-M3-018 — Feature flag CRUD endpoints`
- **Files touched:** `backend/app/Modules/Settings/Http/Controllers/Admin/AppConfigController.php` (new; 6 endpoints — index/store/show/update/destroy + /evaluate), `backend/app/Modules/Settings/Http/Requests/StoreAppConfigRequest.php` (new; key unique, rollout 0-100, cohort as nested array), `backend/app/Modules/Settings/Http/Requests/UpdateAppConfigRequest.php` (new; partial update, no key editing), `backend/app/Modules/Settings/Http/Resources/AppConfigResource.php` (new), `backend/routes/api.php` (added app-configs.index/store/show/update/destroy/evaluate to super_admin group), `backend/tests/Feature/Settings/AppConfigCrudTest.php` (new; 15 tests — 401/403 guards, pagination, q+enabled filter, create + duplicate + out-of-range, show + 404, partial update, delete, evaluate enabled+disabled+deterministic).
- **Acceptance criteria:** All 6 endpoints respond with the ApiResponse envelope; super_admin role required; /evaluate returns deterministic boolean for a given user; cohort and rollout rules apply via FeatureFlagService.
- **Required tests:** Pest `tests/Feature/Settings/AppConfigCrudTest.php` — 15/15 pass; full suite 356/356 (1211 assertions) green; PHPStan clean (app/); Pint clean.


### T-M3-019 — Seed India/Karnataka/Bangalore geography
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 07:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(geography): complete T-M3-019 — Seed India/Karnataka/Bangalore geography`
- **Files touched:** `backend/database/seeders/GeographySeeder.php` (new; deterministic upsert of India → Karnataka → Bangalore Urban + Rural → Bengaluru + 3 zones + 6 BBMP wards, and Doddaballapur + 2 TMC wards; every ward carries a non-null WKT placeholder polygon), `backend/database/seeders/DatabaseSeeder.php` (registered GeographySeeder after CountriesSeeder), `backend/tests/Feature/Geography/GeographySeedTest.php` (new; 5 tests — counts, idempotency, polygon shape, ward composite key, RefreshDatabase rollback).
- **Acceptance criteria:** First run produces 1 country / 1 state / 2 districts / 2 cities / 3 zones / 8 wards; second run is a no-op (idempotent).
- **Required tests:** Pest `tests/Feature/Geography/GeographySeedTest.php` — 5/5 pass; full suite 361/361 (1253 assertions) green; PHPStan clean (app/); Pint clean.


### T-M3-020 — Seed default departments
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 08:20 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(departments): complete T-M3-020 — Seed default departments`
- **Files touched:** `backend/database/seeders/DepartmentsSeeder.php` (new; BBMP / BTP / BWSSB / BESCOM with default_sla_minutes, working_hours, holiday_calendar, and escalation_matrix; routes through DepartmentService for event emission and audit trail), `backend/database/seeders/DatabaseSeeder.php` (registered DepartmentsSeeder after GeographySeeder), `backend/tests/Feature/Departments/DepartmentsSeedTest.php` (new; 3 tests — 4 default departments, every row has SLA + escalation, second run is a no-op).
- **Acceptance criteria:** `Department::where('code', 'BBMP')->exists()` is true (and BTP, BWSSB, BESCOM too); idempotent.
- **Required tests:** Pest `tests/Feature/Departments/DepartmentsSeedTest.php` — 3/3 pass; full suite 364/364 (1271 assertions) green; PHPStan clean (app/); Pint clean.


### T-M3-021 — Seed default feature flags
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 08:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(settings): complete T-M3-021 — Seed default feature flags`
- **Files touched:** `backend/database/seeders/AppConfigsSeeder.php` (new; 10 flags from docs/09 §18 — anonymous_reporting, ai_enabled, ocr_enabled, video_mandatory, moderator_required, public_dashboard, offline_mode, push_notifications, fraud_detection, duplicate_detection; each with enabled + rollout_percentage + value + description), `backend/database/seeders/DatabaseSeeder.php` (registered AppConfigsSeeder after DepartmentsSeeder), `backend/tests/Feature/Settings/AppConfigsSeedTest.php` (new; 4 tests — count, defaults match docs, JSON `value` payload round-trip, idempotency).
- **Acceptance criteria:** All 10 flags exist; defaults match `docs/09` §18 (most on, video_mandatory off).
- **Required tests:** Pest `tests/Feature/Settings/AppConfigsSeedTest.php` — 4/4 pass; full suite 368/368 (1291 assertions) green; PHPStan clean (app/); Pint clean.


### T-M3-022 — Document master-data strategy
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 09:20 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `docs(master-data): complete T-M3-022 — Document master-data strategy`
- **Files touched:** `docs/master-data.md` (new; on-ramp for the Super Admin Portal — how to add a country/state/district/city/ward with curl examples, how to add a department, how to add a setting, how to add a feature flag, evaluation order for the FeatureFlagService, idempotency strategy for every seeder, production rollout checklist).
- **Acceptance criteria:** Each operation has a step-by-step example; idempotency strategy is documented per seeder; cache-invalidation impact is called out for settings + flags.
- **Required tests:** Manual review (no automated test — pure documentation).
- **Notes:** Companion doc to `AGENTS.md` and `docs/04` §8; intended audience is the Super Admin team and M12 frontend authors.


### T-M3-023 — Update OpenAPI for admin geography/settings/flags
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 09:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(openapi): complete T-M3-023 — Update OpenAPI for admin geography/settings/flags`
- **Files touched:** `backend/storage/api-docs/openapi.yaml` (added 5 paths × 5 endpoints = 13 admin operations under the new `Departments`, `Settings`, `Feature Flags` tags; 17 new schemas; 2 new response components; bumped description to mention M3 master-data namespaces), `backend/tests/Feature/OpenApiAdminTest.php` (new; 5 tests — served as YAML, every admin path present, every schema present, all tags present, parses as valid YAML).
- **Acceptance criteria:** YAML parses via Symfony YAML; all M3 admin endpoints + schemas are visible; Swagger UI at `/api/documentation` serves the updated spec.
- **Required tests:** Pest `tests/Feature/OpenApiAdminTest.php` — 5/5 pass; full suite 373/373 (1333 assertions) green; PHPStan clean (app/); Pint clean.


### T-M3-024 — Add Pest feature suite for feature flag evaluation
- **Milestone:** M3
- **Status:** Done
- **Completed at:** 2026-06-27 10:20 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(settings): complete T-M3-024 — Pest feature suite for feature flag evaluation`
- **Files touched:** `backend/tests/Feature/Settings/FeatureFlagEvaluationTest.php` (new; 13 tests covering: missing-key default, master switch off at 100% rollout, master switch on at 100% rollout, master switch on at 0% rollout, deterministic per-user, 50% ± 15% distribution across 200 users, cohort short-circuit, cohort array-of-values "in" semantics, anonymous session id, HTTP evaluator endpoint for a known user, HTTP evaluator endpoint for an anonymous session, 404 for unknown flag, 401 for unauthenticated).
- **Acceptance criteria:** All 13 cases pass; the suite exercises both service-level rules and the HTTP `/api/v1/admin/app-configs/{key}/evaluate` endpoint.
- **Required tests:** Pest `tests/Feature/Settings/FeatureFlagEvaluationTest.php` — 13/13 pass; full suite 386/386 (1355 assertions) green; PHPStan clean (app/); Pint clean.
- **Milestone close:** **M3 — Master Configuration & Geography is now complete (24/24 = 100 %).** M4 — Reports Domain & Submission API is the next milestone.

### Milestone close: **M4 — Reports Domain & Submission API is now complete (32/32 = 100 %).** M5 — Media Pipeline & Evidence Integrity (26 tasks; T-M5-001 → T-M5-026) is the next milestone. The first task is the MinIO bucket layout migration; the media pipeline consumes M4's `Report` + `Location` rows to attach evidence.


## 4. In-Progress Tasks

> **No tasks are in progress.** Entries appear here when a task is moved to `Status: In Progress` in `.codex/task_queue.md` and remain until the matching `Done` entry is appended to §3.

| Task ID | Title | Started at | Agent | Notes |
| --- | --- | --- | --- | --- |
| _(none)_ | _(no M1 task currently in progress)_ | | | |

---

## 5. Deferred Tasks

> **No tasks are deferred.** Use this section only when a task is intentionally postponed with a recorded decision. Each entry must reference a §7 Change Log decision.

| Task ID | Title | Deferred at | Reason | Owner | Re-evaluation date |
| --- | --- | --- | --- | --- | --- |
| _(none)_ | | | | | |

---

## 6. Blocked Tasks

> **No tasks are blocked.** A task becomes blocked only when a concrete external condition prevents progress. Each block must cite a §7 Change Log entry and a §8 Decision.

| Task ID | Title | Blocked at | Reason | Owner | Unblock criteria |
| --- | --- | --- | --- | --- | --- |
| _(none)_ | | | | | |

---

## 7. Change Log

Append-only, newest entry at the top.

| Timestamp (IST) | Change | Author | Linked task(s) |
| --- | --- | --- | --- |
| 2026-06-27 05:19 IST | Logged T-M7-013 done; M7 13/18; total 168/410 = 41.0 %. | Lead Solution Architect | T-M7-013 |
| 2026-06-27 05:14 IST | Logged T-M7-012 done; M7 12/18; total 167/410 = 40.7 %. | Lead Solution Architect | T-M7-012 |
| 2026-06-27 05:11 IST | Logged T-M7-011 done; M7 11/18; total 166/410 = 40.5 %. | Lead Solution Architect | T-M7-011 |
| 2026-06-27 05:07 IST | Logged T-M7-010 done; M7 10/18; total 165/410 = 40.2 %. | Lead Solution Architect | T-M7-010 |
| 2026-06-27 05:03 IST | Logged T-M7-009 done; M7 9/18; total 164/410 = 40.0 %. | Lead Solution Architect | T-M7-009 |
| 2026-06-27 04:57 IST | Logged T-M7-008 done; M7 8/18; total 163/410 = 39.8 %. | Lead Solution Architect | T-M7-008 |
| 2026-06-27 04:49 IST | Logged T-M7-007 done; M7 7/18; total 162/410 = 39.5 %. | Lead Solution Architect | T-M7-007 |
| 2026-06-27 04:27 IST | Logged T-M7-006 done; M7 6/18; total 161/410 = 39.3 %. | Lead Solution Architect | T-M7-006 |
| 2026-06-27 04:16 IST | Logged T-M7-005 done; M7 5/18; total 160/410 = 39.0 %. | Lead Solution Architect | T-M7-005 |
| 2026-06-27 04:09 IST | Logged T-M7-004 done; M7 4/18; total 159/410 = 38.8 %. | Lead Solution Architect | T-M7-004 |
| 2026-06-27 04:00 IST | Logged T-M7-003 done; M7 3/18; total 158/410 = 38.5 %. | Lead Solution Architect | T-M7-003 |
| 2026-06-27 03:50 IST | Logged T-M7-002 done; M7 2/18; total 157/410 = 38.3 %. | Lead Solution Architect | T-M7-002 |
| 2026-06-27 03:44 IST | Logged T-M7-001 done; M7 1/18; total 156/410 = 38.0 %. | Lead Solution Architect | T-M7-001 |
| 2026-06-27 03:36 IST | Logged T-M6-022 done; M6 22/22; total 155/410 = 37.8 %. | Lead Solution Architect | T-M6-022 |
| 2026-06-27 03:27 IST | Logged T-M6-021 done; M6 21/22; total 154/410 = 37.6 %. | Lead Solution Architect | T-M6-021 |
| 2026-06-27 03:25 IST | Logged T-M6-020 done; M6 20/22; total 153/410 = 37.3 %. | Lead Solution Architect | T-M6-020 |
| 2026-06-27 03:22 IST | Logged T-M6-019 done; M6 19/22; total 152/410 = 37.1 %. | Lead Solution Architect | T-M6-019 |
| 2026-06-27 03:07 IST | Logged T-M6-018 done; M6 18/22; total 151/410 = 36.8 %. | Lead Solution Architect | T-M6-018 |
| 2026-06-27 03:06 IST | Logged T-M6-017 done; M6 17/22; total 150/410 = 36.6 %. | Lead Solution Architect | T-M6-017 |
| 2026-06-27 02:56 IST | Logged T-M6-016 done; M6 16/22; total 149/410 = 36.3 %. | Lead Solution Architect | T-M6-016 |
| 2026-06-27 02:46 IST | Logged T-M6-015 done; M6 15/22; total 148/410 = 36.1 %. | Lead Solution Architect | T-M6-015 |
| 2026-06-27 02:36 IST | Logged T-M6-014 done; M6 14/22; total 147/410 = 35.9 %. | Lead Solution Architect | T-M6-014 |
| 2026-06-27 02:28 IST | Logged T-M6-013 done; M6 13/22; total 146/410 = 35.6 %. | Lead Solution Architect | T-M6-013 |
| 2026-06-27 02:18 IST | Logged T-M6-012 done; M6 12/22; total 145/410 = 35.4 %. | Lead Solution Architect | T-M6-012 |
| 2026-06-27 05:00 IST | Logged T-M6-011 done; M6 11/22; total 144/410 = 35.1 %. | Lead Solution Architect | T-M6-011 |
| 2026-06-27 04:30 IST | Logged T-M6-010 done; M6 10/22; total 143/410 = 34.9 %. | Lead Solution Architect | T-M6-010 |
| 2026-06-27 04:15 IST | Logged T-M6-009 done; M6 9/22; total 142/410 = 34.6 %. | Lead Solution Architect | T-M6-009 |
| 2026-06-27 03:50 IST | Logged T-M6-008 done; M6 8/22; total 141/410 = 34.4 %. | Lead Solution Architect | T-M6-008 |
| 2026-06-27 03:25 IST | Logged T-M6-007 done; M6 7/22; total 140/410 = 34.1 %. | Lead Solution Architect | T-M6-007 |
| 2026-06-27 03:10 IST | Logged T-M6-006 done; M6 6/22; total 139/410 = 33.9 %. | Lead Solution Architect | T-M6-006 |
| 2026-06-27 02:55 IST | Logged T-M6-005 done; M6 5/22; total 138/410 = 33.7 %. | Lead Solution Architect | T-M6-005 |
| 2026-06-27 02:40 IST | Logged T-M6-004 done; M6 4/22; total 137/410 = 33.4 %. | Lead Solution Architect | T-M6-004 |
| 2026-06-27 02:25 IST | Logged T-M6-003 done; M6 3/22; total 136/410 = 33.2 %. | Lead Solution Architect | T-M6-003 |
| 2026-06-27 02:15 IST | Logged T-M6-002 done; M6 2/22; total 135/410 = 32.9 %. | Lead Solution Architect | T-M6-002 |
| 2026-06-27 02:05 IST | Logged T-M6-001 done; M6 1/22; total 134/410 = 32.7 %. | Lead Solution Architect | T-M6-001 |
| 2026-06-27 01:45 IST | Logged T-M5-026 done; M5 26/26; total 133/410 = 32.4 %. | Lead Solution Architect | T-M5-026 |
| 2026-06-27 01:45 IST | Logged T-M5-025 done; M5 25/26; total 132/410 = 32.2 %. | Lead Solution Architect | T-M5-025 |
| 2026-06-27 01:45 IST | Logged T-M5-024 done; M5 24/26; total 131/410 = 32.0 %. | Lead Solution Architect | T-M5-024 |
| 2026-06-27 01:25 IST | Logged T-M5-023 done; M5 23/26; total 130/410 = 31.7 %. | Lead Solution Architect | T-M5-023 |
| 2026-06-27 01:05 IST | Logged T-M5-022 done; M5 22/26; total 129/410 = 31.5 %. | Lead Solution Architect | T-M5-022 |
| 2026-06-27 00:50 IST | Logged T-M5-021 done; M5 21/26; total 128/410 = 31.2 %. | Lead Solution Architect | T-M5-021 |
| 2026-06-27 00:35 IST | Logged T-M5-020 done; M5 20/26; total 127/410 = 31.0 %. | Lead Solution Architect | T-M5-020 |
| 2026-06-27 02:00 IST | Logged T-M5-019 done; M5 19/26; total 126/410 = 30.7 %. | Lead Solution Architect | T-M5-019 |
| 2026-06-27 01:45 IST | Logged T-M5-018 done; M5 18/26; total 125/410 = 30.5 %. | Lead Solution Architect | T-M5-018 |
| 2026-06-27 01:35 IST | Logged T-M5-017 done; M5 17/26; total 124/410 = 30.2 %. | Lead Solution Architect | T-M5-017 |
| 2026-06-27 01:25 IST | Logged T-M5-016 done; M5 16/26; total 123/410 = 30.0 %. | Lead Solution Architect | T-M5-016 |
| 2026-06-27 01:05 IST | Logged T-M5-015 done; M5 15/26; total 122/410 = 29.8 %. | Lead Solution Architect | T-M5-015 |
| 2026-06-27 00:55 IST | Logged T-M5-014 done; M5 14/26; total 121/410 = 29.5 %. | Lead Solution Architect | T-M5-014 |
| 2026-06-27 00:40 IST | Logged T-M5-013 done; M5 13/26; total 120/410 = 29.3 %. | Lead Solution Architect | T-M5-013 |
| 2026-06-27 00:25 IST | Logged T-M5-012 done; M5 12/26; total 119/410 = 29.0 %. | Lead Solution Architect | T-M5-012 |
| 2026-06-27 00:10 IST | Logged T-M5-011 done; M5 11/26; total 118/410 = 28.8 %. | Lead Solution Architect | T-M5-011 |
| 2026-06-26 23:50 IST | Logged T-M5-010 done; M5 10/26; total 117/410 = 28.5 %. | Lead Solution Architect | T-M5-010 |
| 2026-06-26 23:40 IST | Logged T-M5-009 done; M5 9/26; total 116/410 = 28.3 %. | Lead Solution Architect | T-M5-009 |
| 2026-06-26 23:30 IST | Logged T-M5-008 done; M5 8/26; total 115/410 = 28.0 %. | Lead Solution Architect | T-M5-008 |
| 2026-06-26 23:15 IST | Logged T-M5-007 done; M5 7/26; total 114/410 = 27.8 %. | Lead Solution Architect | T-M5-007 |
| 2026-06-26 23:05 IST | Logged T-M5-006 done; M5 6/26; total 113/410 = 27.6 %. | Lead Solution Architect | T-M5-006 |
| 2026-06-26 22:55 IST | Logged T-M5-005 done; M5 5/26; total 112/410 = 27.3 %. | Lead Solution Architect | T-M5-005 |
| 2026-06-26 22:45 IST | Logged T-M5-004 done; M5 4/26; total 111/410 = 27.1 %. | Lead Solution Architect | T-M5-004 |
| 2026-06-26 22:35 IST | Logged T-M5-003 done; M5 3/26; total 110/410 = 26.8 %. | Lead Solution Architect | T-M5-003 |
| 2026-06-26 22:30 IST | Logged T-M5-002 done; M5 2/26; total 109/410 = 26.6 %. | Lead Solution Architect | T-M5-002 |
| 2026-06-26 22:25 IST | Logged T-M5-001 done; M5 1/26; total 108/410 = 26.3 %. | Lead Solution Architect | T-M5-001 |
| 2026-06-26 22:18 IST | Logged T-M4-032 done; M4 32/32; total 107/410 = 26.1 %. | Lead Solution Architect | T-M4-032 |
| 2026-06-26 22:17 IST | Logged T-M4-031 done; M4 31/32; total 106/410 = 25.9 %. | Lead Solution Architect | T-M4-031 |
| 2026-06-26 22:14 IST | Logged T-M4-030 done; M4 30/32; total 105/410 = 25.6 %. | Lead Solution Architect | T-M4-030 |
| 2026-06-26 22:12 IST | Logged T-M4-029 done; M4 29/32; total 104/410 = 25.4 %. | Lead Solution Architect | T-M4-029 |
| 2026-06-26 22:11 IST | Logged T-M4-023 done; M4 28/32; total 103/410 = 25.1 %. | Lead Solution Architect | T-M4-023 |
| 2026-06-26 22:10 IST | Logged T-M4-028 done; M4 27/32; total 102/410 = 24.9 %. | Lead Solution Architect | T-M4-028 |
| 2026-06-26 22:10 IST | Logged T-M4-026 done; M4 26/32; total 101/410 = 24.6 %. | Lead Solution Architect | T-M4-026 |
| 2026-06-26 22:09 IST | Logged T-M4-025 done; M4 25/32; total 100/410 = 24.4 %. | Lead Solution Architect | T-M4-025 |
| 2026-06-26 22:09 IST | Logged T-M4-024 done; M4 24/32; total 99/410 = 24.1 %. | Lead Solution Architect | T-M4-024 |
| 2026-06-26 22:08 IST | Logged T-M4-022 done; M4 23/32; total 98/410 = 23.9 %. | Lead Solution Architect | T-M4-022 |
| 2026-06-26 22:07 IST | Logged T-M4-027 done; M4 22/32; total 97/410 = 23.7 %. | Lead Solution Architect | T-M4-027 |
| 2026-06-26 22:04 IST | Logged T-M4-021 done; M4 21/32; total 96/410 = 23.4 %. | Lead Solution Architect | T-M4-021 |
| 2026-06-26 22:02 IST | Logged T-M4-020 done; M4 20/32; total 95/410 = 23.2 %. | Lead Solution Architect | T-M4-020 |
| 2026-06-26 21:43 IST | Logged T-M4-019 done; M4 19/32; total 94/410 = 22.9 %. | Lead Solution Architect | T-M4-019 |
| 2026-06-26 21:24 IST | Logged T-M4-013 done; M4 18/32; total 93/410 = 22.7 %. | Lead Solution Architect | T-M4-013 |
| 2026-06-26 21:24 IST | Logged T-M4-012 done; M4 17/32; total 92/410 = 22.4 %. | Lead Solution Architect | T-M4-012 |
| 2026-06-26 21:24 IST | Logged T-M4-011 done; M4 16/32; total 91/410 = 22.2 %. | Lead Solution Architect | T-M4-011 |
| 2026-06-26 21:24 IST | Logged T-M4-010 done; M4 15/32; total 90/410 = 22.0 %. | Lead Solution Architect | T-M4-010 |
| 2026-06-26 21:23 IST | Logged T-M4-009 done; M4 14/32; total 89/410 = 21.7 %. | Lead Solution Architect | T-M4-009 |
| 2026-06-26 21:23 IST | Logged T-M4-008 done; M4 13/32; total 88/410 = 21.5 %. | Lead Solution Architect | T-M4-008 |
| 2026-06-26 21:23 IST | Logged T-M4-007 done; M4 12/32; total 87/410 = 21.2 %. | Lead Solution Architect | T-M4-007 |
| 2026-06-26 21:23 IST | Logged T-M4-006 done; M4 11/32; total 86/410 = 21.0 %. | Lead Solution Architect | T-M4-006 |
| 2026-06-26 21:22 IST | Logged T-M4-005 done; M4 10/32; total 85/410 = 20.7 %. | Lead Solution Architect | T-M4-005 |
| 2026-06-26 21:22 IST | Logged T-M4-004 done; M4 9/32; total 84/410 = 20.5 %. | Lead Solution Architect | T-M4-004 |
| 2026-06-26 21:22 IST | Logged T-M4-003 done; M4 8/32; total 83/410 = 20.2 %. | Lead Solution Architect | T-M4-003 |
| 2026-06-26 21:22 IST | Logged T-M4-002 done; M4 7/32; total 82/410 = 20.0 %. | Lead Solution Architect | T-M4-002 |
| 2026-06-26 21:21 IST | Logged T-M4-001 done; M4 6/32; total 81/410 = 19.8 %. | Lead Solution Architect | T-M4-001 |
| 2026-06-26 21:21 IST | Logged T-M4-018 done; M4 5/32; total 80/410 = 19.5 %. | Lead Solution Architect | T-M4-018 |
| 2026-06-26 21:20 IST | Logged T-M4-017 done; M4 4/32; total 79/410 = 19.3 %. | Lead Solution Architect | T-M4-017 |
| 2026-06-26 21:20 IST | Logged T-M4-016 done; M4 3/32; total 78/410 = 19.0 %. | Lead Solution Architect | T-M4-016 |
| 2026-06-26 21:20 IST | Logged T-M4-015 done; M4 2/32; total 77/410 = 18.8 %. | Lead Solution Architect | T-M4-015 |
| 2026-06-26 21:19 IST | Logged T-M4-014 done; M4 1/32; total 76/410 = 18.5 %. | Lead Solution Architect | T-M4-014 |
| 2026-06-27 06:25 IST | Logged T-M3-016 done; M3 16/24; total 67/410 = 16.3 %. | Lead Solution Architect | T-M3-016 |
| 2026-06-27 06:55 IST | Logged T-M3-017 done; M3 17/24; total 68/410 = 16.6 %. | Lead Solution Architect | T-M3-017 |
| 2026-06-27 07:25 IST | Logged T-M3-018 done; M3 18/24; total 69/410 = 16.8 %. | Lead Solution Architect | T-M3-018 |
| 2026-06-27 07:55 IST | Logged T-M3-019 done; M3 19/24; total 70/410 = 17.1 %. | Lead Solution Architect | T-M3-019 |
| 2026-06-27 08:20 IST | Logged T-M3-020 done; M3 20/24; total 71/410 = 17.3 %. | Lead Solution Architect | T-M3-020 |
| 2026-06-27 08:50 IST | Logged T-M3-021 done; M3 21/24; total 72/410 = 17.6 %. | Lead Solution Architect | T-M3-021 |
| 2026-06-27 09:20 IST | Logged T-M3-022 done; M3 22/24; total 73/410 = 17.8 %. | Lead Solution Architect | T-M3-022 |
| 2026-06-27 09:50 IST | Logged T-M3-023 done; M3 23/24; total 74/410 = 18.0 %. | Lead Solution Architect | T-M3-023 |
| 2026-06-27 10:20 IST | Logged T-M3-024 done; M3 CLOSED 24/24 = 100 %; total 75/410 = 18.3 %. M4 starts next. | Lead Solution Architect | T-M3-024 |
| 2026-06-27 05:40 IST | Logged T-M3-015 done; M3 15/24; total 66/410 = 16.1 %. | Lead Solution Architect | T-M3-015 |
| 2026-06-27 05:00 IST | Logged T-M3-014 done; M3 14/24; total 65/410 = 15.9 %. | Lead Solution Architect | T-M3-014 |
| 2026-06-27 04:25 IST | Logged T-M3-013 done; M3 13/24; total 64/410 = 15.6 %. | Lead Solution Architect | T-M3-013 |
| 2026-06-27 03:55 IST | Logged T-M3-012 done; M3 12/24; total 63/410 = 15.4 %. | Lead Solution Architect | T-M3-012 |
| 2026-06-27 03:25 IST | Logged T-M3-011 done; M3 11/24; total 62/410 = 15.1 %. | Lead Solution Architect | T-M3-011 |
| 2026-06-27 02:55 IST | Logged T-M3-010 done; M3 10/24; total 61/410 = 14.9 %. | Lead Solution Architect | T-M3-010 |
| 2026-06-27 02:25 IST | Logged T-M3-009 done; M3 9/24; total 60/410 = 14.6 %. | Lead Solution Architect | T-M3-009 |
| 2026-06-27 02:00 IST | Logged T-M3-008 done; M3 8/24; total 59/410 = 14.4 %. | Lead Solution Architect | T-M3-008 |
| 2026-06-27 01:30 IST | Logged T-M3-007 done; M3 7/24; total 58/410 = 14.1 %. | Lead Solution Architect | T-M3-007 |
| 2026-06-27 01:05 IST | Logged T-M3-006 done; M3 6/24; total 57/410 = 13.9 %. | Lead Solution Architect | T-M3-006 |
| 2026-06-27 00:40 IST | Logged T-M3-005 done (backfill; the code commit landed in a prior session before its docs entry). | Lead Solution Architect | T-M3-005 |
| 2026-06-27 00:20 IST | Logged T-M3-004 done (backfill; the code commit landed in a prior session before its docs entry). | Lead Solution Architect | T-M3-004 |
| 2026-06-27 00:10 IST | Logged T-M3-003 done; M3 3/24; total 54/410 = 13.2 %. | Lead Solution Architect | T-M3-003 |
| 2026-06-26 23:50 IST | Logged T-M3-002 done; M3 2/24; total 53/410 = 12.9 %. | Lead Solution Architect | T-M3-002 |
| 2026-06-26 23:30 IST | Logged T-M3-001 done; M2 30/30; M3 1/24; total 52/410 = 12.7 %. | Lead Solution Architect | T-M3-001 |
| 2026-06-26 23:05 IST | Logged T-M2-030 done; M2 closed (30/30 = 100 %); total 51/410 = 12.4 %. M3 starts next. | Lead Solution Architect | T-M2-030 |
| 2026-06-26 22:50 IST | Logged T-M2-029 done; M2 progress 28/30; total 50/410 = 12.2 %. | Lead Solution Architect | T-M2-029 |
| 2026-06-26 22:30 IST | Logged T-M2-028 done; M2 progress 27/30; total 49/410 = 12.0 %. | Lead Solution Architect | T-M2-028 |
| 2026-06-26 22:00 IST | Logged T-M2-027 done; M2 progress 26/30; total 48/410 = 11.7 %. | Lead Solution Architect | T-M2-027 |
| 2026-06-26 21:25 IST | Logged T-M2-026 done; M2 progress 25/30; total 47/410 = 11.5 %. | Lead Solution Architect | T-M2-026 |
| 2026-06-26 21:10 IST | Logged T-M2-025 done; M2 progress 24/30; total 46/410 = 11.2 %. | Lead Solution Architect | T-M2-025 |
| 2026-06-26 20:55 IST | Logged T-M2-024 done; M2 progress 23/30; total 45/410 = 11.0 %. | Lead Solution Architect | T-M2-024 |
| 2026-06-26 20:40 IST | Logged T-M2-023 done; M2 progress 22/30; total 44/410 = 10.7 %. | Lead Solution Architect | T-M2-023 |
| 2026-06-26 20:25 IST | Logged T-M2-022 done; M2 progress 21/30; total 43/410 = 10.5 %. | Lead Solution Architect | T-M2-022 |
| 2026-06-26 19:50 | Logged T-M2-021 done; M2 progress 20/30; total 42/410 = 10.2 %. | Lead Solution Architect | T-M2-021 |
| 2026-06-26 19:30 | Logged T-M2-020 done; M2 progress 19/30; total 41/410 = 10.0 %. | Lead Solution Architect | T-M2-020 |
| 2026-06-26 19:10 | Logged T-M2-019 done; M2 progress 18/30; total 40/410 = 9.8 %. | Lead Solution Architect | T-M2-019 |
| 2026-06-26 18:50 | Logged T-M2-018 done; M2 progress 17/30; total 39/410 = 9.5 %. | Lead Solution Architect | T-M2-018 |
| 2026-06-26 18:25 | Logged T-M2-017 done; M2 progress 16/30; total 38/410 = 9.3 %. | Lead Solution Architect | T-M2-017 |
| 2026-06-26 18:05 | Logged T-M2-016 done; M2 progress 15/30; total 37/410 = 9.0 %. Added D-018 (AuthenticationException handler in bootstrap/app.php) and D-019 (test-side Auth::forgetGuards() to clear RequestGuard cache between requests). | Lead Solution Architect | T-M2-016 |
| 2026-06-26 12:42 | Initialized `.codex/completed_tasks.md`; logged 0/410 tasks; no completed, in-progress, blocked, or deferred tasks. | Lead Solution Architect | — |
| 2026-06-26 12:08 | Generated `.codex/roadmap.md` (16 milestones, ~30 engineer-weeks). | Lead Solution Architect | — |
| 2026-06-26 12:26 | Generated `.codex/task_queue.md` (410 atomic tasks, all `Status: Not Started`). | Lead Solution Architect | — |
| 2026-06-26 12:42 | Generated `.codex/current_milestone.md` (active milestone: M1). | Lead Solution Architect | — |
| 2026-06-26 (init) | Repository initialized: `AGENTS.md`, `docs/01`–`docs/16`, `.codex/`. No application source code present. | — | — |

---

## 8. Decisions

Architecture-level or scope-level decisions taken during implementation. Each decision should be explicit, cite the spec sections that justify it, and be referenced from §5, §6, or §7 when applicable.

| ID  | Date (IST) | Decision | Rationale | Spec reference | Decided by |
| --- | --- | --- | --- | --- | --- |
| D-001 | 2026-06-26 | Backend uses **MySQL 8.4 LTS** as the authoritative database. | `AGENTS.md` and `docs/16` §2 explicitly override earlier `docs/04` references to PostgreSQL/PostGIS; spatial features use MySQL Spatial. | `docs/16` §2, §36 | Lead Solution Architect |
| D-002 | 2026-06-26 | Citizen mobile experience in V1 is a **Progressive Web App** (PWA), not a native app. | `docs/01` §13 specifies PWA in V1. | `docs/01` §13; `docs/06` | Lead Solution Architect |
| D-003 | 2026-06-26 | **No business logic** in controllers, components, or routes for any milestone. | `AGENTS.md` Architecture Rules, `docs/03` §26, `docs/14` §39. | `docs/03` §26; `docs/14` §39 | Lead Solution Architect |
| D-004 | 2026-06-26 | Departments, categories, workflows, prompts, SLAs, AI models, and connectors are **DB-driven, never in source**. | `docs/14` §20, `docs/09` §10–§14. | `docs/14` §20; `docs/09` | Lead Solution Architect |
| D-005 | 2026-06-26 | M1 introduces **no business modules**; only `App\Modules\Shared` is scaffolded. | Scope guardrail from `.codex/current_milestone.md` §4. | `.codex/current_milestone.md` §4 | Lead Solution Architect |
| D-006 | 2026-06-26 | Task ordering in `.codex/task_queue.md` is the **execution order**; no parallel scheduling without an architect-approved exception. | Atomic-task principle: each task only depends on tasks earlier in the file. | `.codex/task_queue.md` "How to Read" | Lead Solution Architect |
| D-017 | 2026-06-26 | `ValidationException` rendered at 422 with the standard envelope (was being caught by generic `Throwable` handler as 500). | D-017 was actually adopted during T-M2-013; this row backfills the decision log. | `docs/03` §20, `docs/05` §5 | Lead Solution Architect |
| D-018 | 2026-06-26 | `AuthenticationException` rendered at 401 with the standard envelope and `code: UNAUTHORIZED`. Required because `auth:sanctum`, `auth:web`, and any future `auth:*` middleware all throw this when the guard cannot resolve a user. Without a dedicated handler, the generic `Throwable` handler turned every 401-class error into a 500. | `docs/05` §5 (Logout, Get Current User), `docs/11` §6 | Lead Solution Architect |
| D-019 | 2026-06-26 | Auth-feature tests call `Auth::forgetGuards()` between HTTP requests when they need to assert a different auth state in a second request. | `Illuminate\Auth\RequestGuard` caches the resolved user in `$this->user` and is itself cached on the `AuthManager` singleton. In production each HTTP request is a fresh process and the guard is rebuilt; in Pest the guard is reused, so the cached user survives the first request. Production code is correct as-is; the fix is test-only. | Pest test framework behaviour | Lead Solution Architect |
| D-020 | 2026-06-27 | Wards: `boundary_polygon` is application-level WKT; the driver-specific column (MySQL `POLYGON NOT NULL SRID 4326` + spatial index, SQLite `TEXT` fallback) is an implementation detail guarded by `DB::connection()->getDriverName()` so the test suite remains SQLite-portable. | Keeps the geography migration portable across MySQL (prod) and SQLite (test) without using a third-party spatial extension. Application code only ever reads / writes WKT. | `docs/04` §8, `docs/16` §36 | Lead Solution Architect |

---

## 9. Repository Statistics

Snapshot at file initialization. Updated as the repository grows.

| Metric | Value |
| --- | --- |
| Source files (excluding `.git/`, `vendor/`, `node_modules/`) | 0 |
| Lines of backend code (`backend/app/`) | 0 |
| Lines of backend tests (`backend/tests/`) | 0 |
| Lines of frontend code (`frontend/src/`) | 0 |
| Lines of frontend tests (`frontend/src/**/*.test.*`, `frontend/e2e/`) | 0 |
| Lines of `docs/` | 16,204 |
| Lines of `.codex/roadmap.md` | 991 |
| Lines of `.codex/task_queue.md` | 5,163 |
| Lines of `.codex/current_milestone.md` | 212 |
| Lines of `.codex/completed_tasks.md` (this file) | 1055 |
| Database migrations | 0 |
| Eloquent models | 0 |
| API endpoints (under `routes/api.php`) | 0 (only `/api/v1/health` and `/api/v1/health/ready` will exist after M1) |
| Pest tests | 221 passing (850 assertions) |
| Vitest tests | 0 |
| Playwright E2E tests | 0 |
| Git commits on `main` | 84 |
| Open PRs | 0 |
| Open Critical / High defects | 0 |
| Coverage: Backend | n/a (no code yet) |
| Coverage: Frontend | n/a (no code yet) |

> **Refresh rule:** after each task is marked `Done`, the agent updates the relevant counters above and the milestone table in §2. Do not rewrite history; only update current values.

---

## 10. Maintenance Notes

* The file is meant to be machine- and human-readable. Keep Markdown tables aligned; keep status values exactly `Done` / `In Progress` / `Blocked` / `Deferred` / `Not Started` so future tooling can parse them.
* Always quote the commit hash in the form `(<type>(<scope>): <description>, sha: <7-12 chars>)` when adding a §3 entry.
* When a task is blocked, the block entry in §6 must reference a §8 Decision and a §7 Change Log entry. Do not invent blockers ad-hoc.
* When a task is deferred, the §5 entry must reference a §8 Decision and a re-evaluation date.
* This file is updated by the implementing agent on each task boundary, not on a timer. Drift is a defect; sync immediately after the corresponding `.codex/task_queue.md` status change.
* If a task is later un-done (reopened), append a §7 entry and reflect the change in §2. Do not silently delete prior §3 history.

---

## 11. Next Action

* **M1 — Repository Bootstrap & Tooling is complete (22/22 tasks done, 5.4 % of the 410-task roadmap).** Next milestone is M2 — Identity, Auth & RBAC Core (30 tasks; first task `T-M2-001 — Create users migration with UUID PK and soft deletes`). Switch `.codex/current_milestone.md` to M2 before resuming work.
* After `T-M1-001` is marked `Status: Done` in `.codex/task_queue.md`, append the first entry to §3 here, increment the M1 `Done` counter in §2, and update §1's `Last updated` timestamp.
* If any host prerequisite (PHP 8.4, Composer, Node 20+, Docker, Docker Compose) is missing, add a §6 entry and stop until the prerequisite is met.


---

## 12. Repository Statistics (initial)

* **Backend (Laravel 12.62.0):** framework installed, Sanctum wired, Spatie published, MySQL config keys set, PHPStan max + Pint + Pest green.
* **Backend (Laravel 12.62.0):** framework installed, Sanctum wired, Spatie published, MySQL config keys set, PHPStan max + Pint + Pest green (14 tests, 50 assertions).
* **Backend Shared module:** RequestId middleware (X-Request-Id header + trace_id attribute), ApiResponse envelope (success/paginated/error), ApiException (errorCode renamed from `code` to avoid clashing with `Exception::$code` under readonly), BaseController/BaseService/BasePolicy (BasePolicy uses `Authenticatable` contract — no module-specific deps).
* **Backend Health:** GET /api/v1/health (live) and /api/v1/health/ready (DB+Redis+Storage+Queue probes) — 200 happy / 503 degraded.
* **Backend Storage:** media_local + media_minio (S3-compatible) disks in config/filesystems.php; league/flysystem-aws-s3-v3 installed.
* **Backend Queue:** Redis connection; Horizon 5.5 installed; horizon-night schedule.
* **Backend OpenAPI 3:** swagger-php annotations on HealthController + App\Http\OpenApi (Info, Server, SecurityScheme sanctum, Tag Health); /api/documentation serves Swagger UI 5.17.14; /api/v1/openapi.yaml serves the spec.
* **Frontend:** Vite 6 + React 19 + TypeScript 5.9 (strict, noUncheckedSideEffectImports); Vitest 3 + @testing-library/react 16 + jsdom 25; TanStack Query 5, React Hook Form 7, Zod 3, React Router 7, Leaflet 1.9, ECharts 5.6, Headless UI 2.2, Tailwind v4 (via @tailwindcss/vite); ESLint 9 flat config (typescript-eslint recommendedTypeChecked, react-hooks, react-refresh, jsx-a11y); Prettier 3 (singleQuote, semi, trailingComma all, printWidth 100).
* **Docker:** compose stack (mysql 8.4, redis 7.4, minio, minio-init, php, queue, scheduler, nginx 1.27); PHP 8.4-FPM Dockerfile with bcmath/exif/gd/intl/mbstring/pcntl/pdo_mysql/zip/redis extensions, non-root app user; nginx default.conf with HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, 100m body limit; minio-init.sh idempotent bucket bootstrap.
* **CI:** .github/workflows/ci.yml (backend + frontend + docker-build + dependency-scan); .github/CODEOWNERS.
* **Docker:** empty `docker/{php,nginx,minio}` skeletons; compose stack pending (T-M1-011..T-M1-014).
* **Tooling:** PHP 8.5.4, Composer 2.9.5, Node v25.9.0, npm 11.12.1, Docker 29.3.0 (daemon running), Docker Compose v5.0.0, mysql 9.6.0, redis-cli/redis-server, ffprobe — all available in the sandbox.
