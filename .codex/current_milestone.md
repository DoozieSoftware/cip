# Current Milestone — M8: AI Vision Pipeline & Provider Abstraction

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** **M7 CLOSED 18/18 = 100 %** (M1–M7 complete; M8 starts next)
**Last updated:** 2026-06-27 05:46 IST (after T-M7-018 done; M7 18/18; M7 CLOSED; total 173/410 = 42.2 %)

> M1 (22/22), M2 (22/22), M3 (30/30), M4 (32/32), M5 (22/22), M6 (22/22), and M7 (18/18) are complete. **M7 is the routing layer** — the JSON DSL (`category_in`, `ward_in`, `district_in`, `severity_in`, `keyword_match`, `time_of_day_between`, `ai_label_in`) with AND/OR composition, the `RoutingEngine` + `RoutingCondition` + `RoutingRepository` (1h cache, `routing` tag), the `AssignmentService` (round-robin via cache cursor), the `ReportAssigned` event, the `RoutingFallbackService` (`app_configs.routing_default_department_id`), the `AiCompletedListener` that bridges M7 routing to the M6 workflow engine's new `ai_auto_assign` transition, the `ReassignService` for manual overrides, the `RoutingAdminService` (CRUD + reorder + audit + cache invalidation), the Super Admin REST surface, the `RoutingRulesSeeder` with the three Bangalore sample rules, the OpenAPI extension, `docs/routing.md`, the README cross-link, and 109 new tests. The M7 module is fully wired to the M4 reports + M6 workflow + future M8 AI vision (via the `AiCompleted` event stub).

**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M8, `.codex/task_queue.md` §M8, `docs/03` §7, `docs/10` (entire), `docs/04` §10, `docs/05` §11, `docs/11` §28.

---

## 1. Current Milestone

* **Milestone ID:** M8
* **Title:** AI Vision Pipeline & Provider Abstraction
* **Estimated complexity:** **High** (multi-provider abstraction, prompt versioning, async job pipeline, retry / fallback, audit + cost tracking)
* **Estimated duration:** 2 weeks
* **Total tasks:** see `.codex/task_queue.md` §M8
* **Status:** **Not Started** (0 %)
* **Depends on:** M1 (buildable repo, base `Shared` utilities), M2 (audit + rate limiters + role), M3 (geography + categories + master-config), M4 (Report + media rows), M5 (signed media URLs), M6 (workflow `ai_processing` + `ai_auto_assign` states), M7 (`AiCompleted` event stub + routing).
* **Unblocks:** M9 (Notifications — needs the `AiCompleted` consumer for staff alerts), M10–M13 (portals render the AI labels / confidence scores), M14 (Analytics consumes the `ai_results` rows).

---

## 2. Objective

Land the AI vision pipeline end-to-end. This includes the `ai_provider_configs` and `prompt_versions` master tables, the `AiProvider` interface + at least one concrete implementation (OpenAI-compatible HTTP client), the deterministic `prompt_versions` registry with `draft | approved | deprecated` lifecycle, the `VisionService` orchestrator that calls the provider with the report's media URLs and writes the structured `ai_results` row, the queued `RunVisionJob` with retry / fallback, the `ai_label` column on `reports` that M7 routing already reads, the `vision.provider` setting, the Super Admin REST surface for provider configs + prompt versions, the audit log for every AI call, and `docs/ai.md`.

---

## 3. Deliverables (per `.codex/roadmap.md` §M8)

* `ai_provider_configs` table (UUID PK, `code` unique, `base_url`, `auth_type`, `api_key_secret_id` nullable FK to a secrets table, `model`, `temperature`, `timeout_ms`, `retry_count`, `is_fallback` bool, `priority` int, `active`).
* `prompt_versions` table (UUID PK, `(name, version)` unique, `purpose`, `provider_code`, `prompt_text`, `expected_json_schema` JSON, `status` enum, `approved_by` + `approved_at`).
* `ai_results` table (UUID PK, `report_id` FK, `provider_id` FK, `prompt_version_id` FK, `labels` JSON, `confidence` JSON, `raw_response` JSON, `latency_ms`, `cost_usd`, `error` nullable, `attempt` int).
* `AiProviderInterface` + concrete `OpenAiCompatibleProvider` and a `LocalStubProvider` for tests.
* `VisionService::run(Report, Media[])` returns a structured `VisionResult` value object.
* `RunVisionJob` queueable with `tries = provider.retry_count`, `backoff = [10, 30, 60]`, and provider fallback on hard failure.
* `ai_label` column on `reports` (already shipped in T-M7-003) — M8 must populate it from the `ai_results.labels` payload.
* `vision.provider` setting + `app_configs` keys for the per-feature prompt overrides.
* Super Admin REST surface for provider configs + prompt versions; OpenAPI extension.
* Pest feature coverage for the provider abstraction, the prompt version lifecycle, the fallback chain, the queueable job, and the audit + cost tracking.
* `docs/ai.md` authored.

---

## 4. Scope (current milestone)

* In scope: the `ai_*` tables, the provider abstraction, the orchestrator + job, the `ai_label` population, the admin REST + OpenAPI, the audit + cost rows, the test coverage, the docs.
* Out of scope: the M10 portal rendering of the AI confidence chips, the M14 analytics dashboards, the actual model integration tuning (provider-specific prompt engineering), the streaming response support.

---

## 5. Exit Criteria

* All M8 tasks in `.codex/task_queue.md` marked `Done`.
* `vendor/bin/pest` is green (the full platform suite; 818/818 today, 818 + new M8 tests).
* Every new REST endpoint has OpenAPI coverage and a Pest feature test.
* Every AI call writes an `audit_logs` row.
* `docs/ai.md` describes the provider abstraction, the prompt-version lifecycle, the fallback chain, and the `ai_label` contract.
* The `app_configs` row for `vision.provider` is documented and seeded.
* M8 closes M7's `AiCompleted` event stub — the listener is now firing from a real `VisionService::run()` instead of being dispatched manually in tests.

---

## 6. Documents to read before implementation

* `AGENTS.md` — coding standards, security rules, AI rules (AI never decides legally, AI only recommends, moderator overrides).
* `.codex/roadmap.md` §M8.
* `.codex/task_queue.md` §M8 (T-M8-001 → end).
* `docs/10-AI-and-Vision-Engine-Specification.md` (entire).
* `docs/03-System-Architecture.md` §7 (the AI provider section).
* `docs/04-Database-Design.md` §10 (the `ai_*` tables).
* `docs/05-REST-API-Specification.md` §11 (the AI REST surface).
* `docs/11-Security-and-Anti-Fraud-Specification.md` §28 (AI audit + cost tracking).
* The existing `AiCompleted` event in `app/Modules/AI/Events/AiCompleted.php` and the `AiCompletedListener` in `app/Modules/AI/Listeners/AiCompletedListener.php` — M8 must produce events that the listener already consumes.

---

## 7. Current Implementation Status

* **M1 (Bootstrap):** 22/22 = 100 % — CLOSED.
* **M2 (Authentication):** 22/22 = 100 % — CLOSED.
* **M3 (Master Data):** 30/30 = 100 % — CLOSED.
* **M4 (Reports):** 32/32 = 100 % — CLOSED.
* **M5 (Media):** 22/22 = 100 % — CLOSED.
* **M6 (Workflow):** 22/22 = 100 % — CLOSED.
* **M7 (Routing):** 18/18 = 100 % — CLOSED.
* **M8 (AI Vision):** 0/30 = 0 % — **active**.
* **Total:** 173/410 = 42.2 %.

## 8. Blocking Issues

* None. The M7 `AiCompleted` event stub is the wiring point; M8 only has to fire it from a real `VisionService::run()` instead of a test dispatch.

## 9. Next Milestone

* **M9 — Notifications & Communication.** M9 consumes the `ReportAssigned`, `ReportStatusChanged`, and `AiCompleted` events that M6 / M7 / M8 produce. SMS + email + push fan-out, template registry, per-channel audit, rate limiting.
