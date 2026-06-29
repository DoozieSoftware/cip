# Current Milestone — M9: Notification & Eventing Platform

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** **M1–M10 CLOSED 252/252 = 100 %**; total 252/410 = 61.5 %.
**Last updated:** 2026-06-28 (M10 28/28 closed; portal + OpenAPI + tests + docs done)

> M1 (22/22), M2 (30/30), M3 (24/24), M4 (32/32), M5 (26/26), M6 (22/22), M7 (18/18), M8 (30/30), and M9 (20/20) are complete. **M8 is the AI vision pipeline** — the `ai_provider_configs` + `prompt_versions` + `ai_jobs` + `ai_results` + `ai_labels` tables, the `AIProviderInterface` with `MockProvider` / `OpenAICompatibleProvider` / `QwenVLProvider`, the `PiiMaskingService` + `ImageQualityAnalyzer` + `DuplicateDetector` + `FraudScorer` + `ConfidenceAggregator` + `AiResponseValidator` + `ProviderFailoverService`, the `AiPipelineOrchestrator` queueable job, the `AiCompleted` event bridged to M7 routing, the `ReportAssigned` listener that fires the AI pipeline on submit, the internal `/api/v1/internal/ai/{process,job,result}` REST surface, the Super Admin `/api/v1/admin/ai/{providers,prompts}` CRUD (with approve + rollback), the `AiBenchmarkSuite` (50-case + 5 negative), the default seeders (`Mock` provider, 3 base system prompts as approved v1), the OpenAPI extension, `docs/ai.md`, and 109 new tests. **M9 is the notification fan-out** — the `notifications` + `notification_templates` + `notification_logs` + `notification_preferences` tables, the `ChannelInterface` + `ChannelResult`, the five concrete channels (`LogChannel`, `MailChannel`, `PushChannel` FCM stub, `SmsChannel` + `LogSmsGateway` driver, `WebhookChannel` HMAC-signed), the `TemplateEngine` (curly-brace placeholders + escape + version pick), the `NotificationDispatcher` (preference gate + opt-out short-circuit), the `SendNotificationJob` (`tries=5`, backoff `[60, 300, 900, 3600]`, dead-letter on retry exhaustion), the `ReportAssigned` / `ReportStatusChanged` / `AiCompleted` / `SecurityEvent` listeners wired in `AppServiceProvider`, the citizen `/api/v1/notifications` + `/api/v1/notifications/{id}/read` + `/api/v1/notifications/preferences` REST surface, the `NotificationTemplatesSeeder` (6 default templates), the `docs/notifications.md` doc, the `OpenApiNotificationsTest` contract check, and 100 new tests. The M9 module is fully wired to M4 reports + M6 workflow + M7 routing + M8 AI vision (consumes `AiCompleted` for `ai.classified` and `ReportAssigned` for `report.assigned`).

**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M10, `.codex/task_queue.md` §M10, `docs/03` §4, `docs/07` (entire), `docs/13` (entire), `docs/15` §7, §9.

---

## 1. Current Milestone

* **Milestone ID:** M10
* **Title:** Moderator Portal
* **Estimated complexity:** High (full SPA for the moderator workflow — queue, duplicate review, fraud triage, manual override, audit, status transitions, reassignment).
* **Estimated duration:** 2–3 weeks
* **Total tasks:** see `.codex/task_queue.md` §M10
* **Status:** **CLOSED** — 28/28 = 100 % (T-M10-001..T-M10-028 done)
* **Depends on:** M1 (buildable repo, base `Shared` utilities), M2 (auth + RBAC + `Moderator` role), M4 (Report + media), M5 (signed media URLs), M6 (workflow engine + transitions), M7 (routing + reassign), M8 (AI labels / confidence / fraud / duplicate scores), M9 (citizen notifications on moderator decision).
* **Unblocks:** M11 (Operations Portal), M12 (Super Admin Portal), M13 (Citizen PWA — moderation timeline view).

---

## 2. Objective

Land the Moderator Portal end-to-end. This includes the `Moderation` module skeleton (controller, policy, service, resources, request DTOs), the `ModerationService` review/merge/reject/escalate operations, the `ReassignService` reuse, the moderator queue REST surface (`/api/v1/moderator/queue`, `/api/v1/moderator/duplicates`, `/api/v1/moderator/fraud`), the per-report moderation detail endpoint, the AI overlay (labels, confidence, fraud, duplicate scores, recommended department), the audit + per-action logging, the workflow transitions (`pending_review → approved`, `pending_review → rejected`, `pending_review → merged`, `pending_review → escalated`), the OpenAPI extension, the Pest feature coverage, the React `Moderator` portal with TanStack Query + React Hook Form + Zod, the queue / duplicate / fraud / detail / override / audit views, the a11y + Vitest + Playwright coverage, and `docs/moderator.md`.

---

## 3. Deliverables (per `.codex/roadmap.md` §M10)

* `app/Modules/Moderation/` — controller, policy, service, DTOs, resources, requests.
* `ModerationService::review(Report, ModerationDecisionDto, Moderator)` — applies the moderator's decision (approve / reject / merge / escalate), writes the audit row, and emits the right event(s).
* `ModerationService::merge(Report, canonicalReportId, Moderator)` — soft-merges a duplicate into the canonical report.
* `ModerationService::reject(Report, reasonCode, notes, Moderator)` — closes a report with rejection.
* `ModerationService::escalate(Report, reasonCode, notes, Moderator)` — moves the report to a `senior_moderator` queue.
* `ModerationPolicy` — `view`, `viewQueue`, `review`, `merge`, `reject`, `escalate`, `reassign` abilities.
* REST surface:
  * `GET /api/v1/moderator/queue` — paginated, filter by status / category / ward / district / ai_label.
  * `GET /api/v1/moderator/duplicates` — paginated list of `duplicate_score > 60` reports.
  * `GET /api/v1/moderator/fraud` — paginated list of `fraud_score > 60` reports.
  * `GET /api/v1/moderator/reports/{id}` — full detail with AI overlay, media, audit, transitions.
  * `POST /api/v1/moderator/reports/{id}/review` — apply the moderator's decision.
  * `POST /api/v1/moderator/reports/{id}/merge` — merge a duplicate into a canonical.
  * `POST /api/v1/moderator/reports/{id}/reject` — reject with reason + notes.
  * `POST /api/v1/moderator/reports/{id}/escalate` — escalate to senior queue.
* AI overlay data on the detail endpoint — `ai_label`, `confidence`, `recommended_department`, `fraud_score`, `duplicate_score`, `quality_score`.
* Workflow transitions `pending_review → approved`, `pending_review → rejected`, `pending_review → merged`, `pending_review → escalated` wired into the M6 engine.
* OpenAPI extension under the `Moderation` tag.
* Pest feature coverage for the policy, the service, the REST endpoints, the audit + workflow wiring.
* React `Moderator` portal under `frontend/src/portals/moderator/` — queue / duplicates / fraud / detail / override / audit views.
* Vitest + Playwright + axe-core coverage.
* `docs/moderator.md`.

---

## 4. Scope (current milestone)

* In scope: the `Moderation` module backend, the REST surface, the AI overlay wiring, the workflow transitions, the OpenAPI + tests, the React portal, the docs.
* Out of scope: the M11 Operations Portal (department officer UI), the M12 Super Admin Portal (cross-cutting config), the M13 Citizen PWA (timeline + status view), the M14 connector framework.

---

## 5. Exit Criteria

* All M10 tasks in `.codex/task_queue.md` marked `Done`.
* `vendor/bin/pest` is green (the full platform suite; 1106+ new M10 tests).
* Every new REST endpoint has OpenAPI coverage and a Pest feature test.
* Every moderation action writes an `audit_logs` row + the right `report_status_history` row.
* `docs/moderator.md` describes the queue, the decisions, the audit trail, and the AI overlay.
* The Moderator portal renders, has a passing Vitest + Playwright + axe-core suite, and the queue / detail flows are wired end-to-end.

---

## 6. Documents to read before implementation

* `AGENTS.md` — coding standards, security rules, RBAC rules.
* `.codex/roadmap.md` §M10.
* `.codex/task_queue.md` §M10 (T-M10-001 → end).
* `docs/07-Moderator-Portal-Specification.md` (entire).
* `docs/03-System-Architecture.md` §4 (Moderator Portal context).
* `docs/05-REST-API-Specification.md` §8 (Moderator REST surface).
* `docs/13-UI-Design-System.md` (entire).
* `docs/15-QA-and-Test-Strategy.md` §7, §9 (Moderator test scope).
* The existing `ReassignService` in `app/Modules/Routing/Services/ReassignService.php` and the M7 routing REST — the moderation reassign path should reuse the same service.

---

## 7. Current Implementation Status

* **M1 (Bootstrap):** 22/22 = 100 % — CLOSED.
* **M2 (Authentication):** 30/30 = 100 % — CLOSED.
* **M3 (Master Data):** 24/24 = 100 % — CLOSED.
* **M4 (Reports):** 32/32 = 100 % — CLOSED.
* **M5 (Media):** 26/26 = 100 % — CLOSED.
* **M6 (Workflow):** 22/22 = 100 % — CLOSED.
* **M7 (Routing):** 18/18 = 100 % — CLOSED.
* **M8 (AI Vision):** 30/30 = 100 % — CLOSED.
* **M9 (Notifications):** 20/20 = 100 % — CLOSED.
* **M10 (Moderator Portal):** 28/28 = 100 % — **CLOSED** (all 28 tasks done).
* **Total:** 252/410 = 61.5 %.

---

## 8. Blocking Issues

* None. M9 closes the last event consumer the moderator portal needs (`AiCompleted` → `ai.classified`, `ReportAssigned` → `report.assigned`).

---

## 9. Next Milestone

* **M11 — Operations Portal (Department).** M11 consumes the `ReportAssigned` event for the department officer inbox and renders the per-department queue, the assignment view, and the field-update view.
