# AI Vision Engine (M8)

The AI vision engine is the **recommendation layer** that runs on every
incoming civic report after the citizen has submitted it. It is not a
decision-maker — it produces a structured recommendation
(category, severity, department hint, quality / duplicate / fraud
scores) that the M6 workflow engine + M7 routing engine + a human
moderator consume. Per `docs/10` §1, **AI never makes legal decisions**;
it only recommends; the moderator always overrides.

This document describes the production wiring of the engine:
provider abstraction, prompt lifecycle, confidence rules, PII masking,
failover, and the benchmark suite. It is the operational companion to
`docs/10` (spec) and `docs/15` (test strategy).

## Pipeline at a glance

```
   report submitted
        │
        ▼
 ReportStatusChanged (submitted → ai_processing)
        │
        ▼
 ReportSubmittedListener  ── guards on approved prompt + active provider
        │
        ▼
 AiPipelineOrchestrator  (queue: ai-pipeline)
        │
        ▼
 ┌────────────────────────────────────────────────────┐
 │  1. PiiMaskingService.mask(title+description)      │
 │  2. ImageQualityAnalyzer.score(media)               │
 │  3. ai_enabled app_config check — if OFF, skip      │
 │     straight to a zero-confidence result (7)        │
 │  4. provider.classify(AiRequest) via                │
 │     ProviderFailoverService (skipped if 3 is off)   │
 │  5. AiResponseValidator.validate(resp)              │
 │  6. DuplicateDetector.detect / FraudScorer.score    │
 │  7. persist ai_jobs / ai_results / labels           │
 │  8. emit AiCompleted                                │
 └────────────────────────────────────────────────────┘
        │
        ▼
 AiCompletedListener — ConfidenceAggregator.decide(conf × 100)
        │
        ▼
   report → pending_moderator (below auto-route threshold)
          | assigned via routing rules (at/above threshold)
```

The pipeline is the single integration point between the rest of the
platform and any AI provider. It is implemented in
`backend/app/Modules/AI/Jobs/AiPipelineOrchestrator.php` and is
unit-tested in `tests/Feature/AI/PipelineOrchestratorTest.php`.
`ConfidenceAggregator` is applied **after** the pipeline, inside
`App\Modules\AI\Listeners\AiCompletedListener` — it gates whether the
AI's routing recommendation is auto-applied or held for a moderator's
`moderator_review` review (see "Confidence rules" below).

## Endpoints

| Method | Path                                                | Audience                    | Notes                                          |
| ------ | --------------------------------------------------- | --------------------------- | ---------------------------------------------- |
| GET    | `/api/v1/admin/ai/providers`                        | Super Admin                 | Paginated list                                 |
| POST   | `/api/v1/admin/ai/providers`                        | Super Admin                 | Create provider config                         |
| GET    | `/api/v1/admin/ai/providers/{provider}`             | Super Admin                 | Single provider (secrets masked)               |
| PUT    | `/api/v1/admin/ai/providers/{provider}`             | Super Admin                 | Partial update                                 |
| DELETE | `/api/v1/admin/ai/providers/{provider}`             | Super Admin                 | Remove provider                                |
| POST   | `/api/v1/admin/ai/providers/{provider}/test`        | Super Admin                 | Live `healthCheck()` probe; not persisted      |
| POST   | `/api/v1/admin/ai/providers/{provider}/activate`    | Super Admin                 | Shortcut for `PUT` with `{"active": true}`     |
| GET    | `/api/v1/admin/ai/prompts`                          | Super Admin                 | Paginated list                                 |
| POST   | `/api/v1/admin/ai/prompts`                          | Super Admin                 | Create a prompt version                        |
| GET    | `/api/v1/admin/ai/prompts/{prompt}`                 | Super Admin                 | Single prompt version                          |
| PUT    | `/api/v1/admin/ai/prompts/{prompt}`                 | Super Admin                 | Update (only on draft rows)                    |
| DELETE | `/api/v1/admin/ai/prompts/{prompt}`                 | Super Admin                 | Remove                                         |
| POST   | `/api/v1/admin/ai/prompts/{prompt}/approve`         | Super Admin                 | Approve, deprecate the prior approved row      |
| POST   | `/api/v1/admin/ai/prompts/{prompt}/rollback`        | Super Admin                 | Re-approve a deprecated row, demote the active |
| POST   | `/api/v1/internal/ai/process/{reportId}`            | System (mTLS in prod)       | Enqueue the pipeline; returns 202 + job id     |
| GET    | `/api/v1/internal/ai/job/{id}`                      | System                      | Job status                                     |
| GET    | `/api/v1/internal/ai/job/{id}/result`               | System                      | Result + labels                                |

The full OpenAPI surface is in
`backend/storage/api-docs/openapi.yaml` and is contract-tested by
`tests/Feature/OpenApiAiTest.php`.

## Domain model

Six tables back the engine; all PKs are UUIDs and follow the platform
convention (InnoDB, utf8mb4, `created_at` / `updated_at` / `softDeletes`).

- `ai_provider_configs`
  - `id`, `code` (unique instance identifier, e.g. `openrouter-prod`),
    `driver` (type discriminator: `mock` | `qwen_vl` |
    `openai_compatible` — see "Provider abstraction" below),
    `name`, `base_url`, `auth_type` enum `{none, bearer, api_key, oauth}`
  - `credentials` (encrypted JSON, e.g. `{"api_key": "..."}`;
    **never serialized** — see `AiProviderConfigResource`, which
    exposes a `has_secret` boolean instead)
  - `extra_headers` (JSON map of static headers, e.g. OpenRouter's
    `HTTP-Referer`/`X-Title`)
  - `model`, `temperature` 0..2, `timeout_ms` 1..120000,
    `retry_count` 0..10
  - `priority` (lower = higher precedence), `is_fallback`, `active`
- `prompt_versions` (T-M8-006)
  - `id`, `name` (e.g. `category_classifier`), `version` int ≥ 1
  - `purpose`, `provider_code`, `prompt_text`,
    `expected_json_schema` (JSON-schema as string)
  - `status` enum `{draft, approved, deprecated}`
  - **Unique** on `(name, version)` so a name+version pair is
    immutable. To change the active prompt for a name, create a new
    row at `version+1` and call `POST /prompts/{id}/approve`.
- `ai_jobs`
  - `id`, `report_id` (FK cascade), `provider_code`,
    `prompt_version_id` (FK restrict)
  - `status` enum `{queued, running, succeeded, failed}`,
    `attempts`, `error`, `started_at`, `finished_at`
- `ai_results`
  - `id`, `job_id` (FK cascade),
    `predicted_type`, `confidence` 0..1, `recommended_department`,
    `severity` enum `{low, medium, high, critical}`,
    `quality_score` 0..100, `duplicate_score` 0..100,
    `fraud_score` 0..100, `summary`
- `ai_labels`
  - `id`, `result_id` (FK cascade), `label`, `confidence` 0..1,
    `is_primary` bool
- `security_events` (read-only dependency for `FraudScorer`)

## Provider abstraction

Every concrete provider implements
`App\Modules\AI\Contracts\AIProviderInterface`:

```php
interface AIProviderInterface
{
    public function getName(): string;
    public function getModel(): string;
    public function healthCheck(): bool;
    public function classify(AiRequest $request): AiResponse;
}
```

Three implementations ship today, selected by the `driver` column
(not `code` — `code` is just the row's unique instance name):

| Driver               | Class                                                | When to use                                                  |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------|
| `mock`               | `App\Modules\AI\Providers\MockProvider`               | dev, test, and CI (no external calls)                        |
| `qwen_vl`            | `App\Modules\AI\Providers\QwenVLProvider`             | Alibaba Qwen-VL; fixed DashScope endpoint + model defaults    |
| `openai_compatible`  | `App\Modules\AI\Providers\OpenAICompatibleProvider`   | any OpenAI chat-completions-shaped API — **OpenRouter, a Modal.com-deployed vision endpoint, Azure OpenAI, or self-hosted vLLM/Together-style gateways all use this driver** |

`App\Modules\AI\Support\AiProviderFactory::make(AiProviderConfig $cfg)`
is the single place that turns a config row into a real provider
instance — it reads `base_url`, `model`, `credentials.api_key`,
`extra_headers`, `timeout_ms`, and `temperature` straight off the row.
`App\Modules\AI\Providers\AiServiceProvider` calls the factory for
every `active = true` row at boot and binds the result into
`ProviderFailoverService` — this is the piece that makes "swap
providers via the Super Admin screen, zero code changes" actually
true; before it existed, `ProviderFailoverService`'s binding map was
always empty and every real classification request failed.

### Adding a custom OpenAI-compatible provider (OpenRouter, Modal.com, …)

No PHP changes are needed for any endpoint that accepts the standard
`POST {base_url}/v1/chat/completions` shape. From the Super Admin →
AI → Providers screen (or `POST /api/v1/admin/ai/providers`):

1. **`driver`**: `openai_compatible`.
2. **`base_url`**: e.g. `https://openrouter.ai/api` (OpenRouter) or
   your Modal.com app's HTTPS URL. No trailing slash.
3. **`credentials.api_key`**: the provider's API key / bearer token —
   write-only, masked as `has_secret: true` on every read.
4. **`extra_headers`** (optional): static headers the endpoint
   requires beyond the bearer token — OpenRouter recommends
   `HTTP-Referer` and `X-Title`; a Modal.com deployment might need a
   custom auth header alongside the bearer token.
5. **`model`**: the upstream model id, e.g. `openrouter/auto` or your
   Modal deployment's model slug.
6. **`priority`** / **`is_fallback`** / **`active`**: same semantics
   as every other row — lower priority wins among active,
   non-fallback rows.

`OpenAICompatibleProvider::healthCheck()` tries `GET /v1/models`
first and falls back to a bare connectivity check against `base_url`
on a 404, since many custom-deployed endpoints (Modal.com in
particular) don't expose an OpenAI-style model listing. Use the
"Test" button on the admin screen to verify connectivity before
flipping a new row `active`.

### Modal vision input receipt

The bundled Modal deployment in `scripts/modal_vision_vllm.py` accepts both
base64 `data:image/...` references and HTTPS image URLs. It must return
`usage.image_count` and `usage.image_sizes` with every multimodal response.
The backend rejects a `modal-vision` result when the acknowledged image count
does not equal the number sent. This is deliberate fail-closed behaviour: a
text-only hallucination must reach moderator review rather than being stored
as a successful visual classification.

Local-disk evidence is embedded as a data URI by
`AiMediaReferenceResolver`, because a cloud model cannot fetch a signed URL
whose host is `localhost`. S3/MinIO evidence continues to use a temporary
presigned URL.

Before provider inference, `ImageQualityAnalyzer` checks decoded pixel
brightness, contrast, and edge detail in addition to size and resolution.
Evidence below the configured quality threshold is persisted as
`unclassified` with zero confidence and sent to manual review without calling
the vision provider. Provider confidence is capped by the effective evidence
quality score so a habitual model value such as `0.95` is not stored unchanged
for every report.

Deploy the current endpoint with:

```bash
modal deploy scripts/modal_vision_vllm.py
```

The health response must report service version
`2026-07-14-vision-receipt-v1` before enabling `modal-vision`.

If a provider's wire format is genuinely **not**
chat-completions-shaped, write a small class implementing
`AIProviderInterface` (typically < 100 lines), add a new driver
constant + `match` arm to `AiProviderFactory::make()`, and add it to
`StoreAiProviderRequest`/`UpdateAiProviderRequest`'s `driver` enum.
The orchestrator, validator, and aggregator do not need to change.

## Prompt lifecycle

Prompts are versioned, immutable per `(name, version)`, and have a
lifecycle of three states:

```
   draft  ──POST /prompts/{id}/approve──▶  approved
     ▲                                       │
     │                                       │  POST /prompts/{id}/approve
     │                                       │  on a newer row
     │                                       ▼
     └───────────────────  deprecated  ◀─────┘
                                  ▲
                                  │  POST /prompts/{id}/rollback
                                  │  on a deprecated row
```

Three base prompts ship in `PromptsSeeder` (T-M8-026):

- `category_classifier` (v1) — picks the canonical report category
- `severity_estimator` (v1) — assigns `{low, medium, high, critical}`
- `ai_labeller` (v1) — emits the full per-label confidence map used
  by M7 routing

To change a prompt safely:

1. `POST /api/v1/admin/ai/prompts` with the same `name` and
   `version = current+1`, `status: draft`. The new row is
   inert.
2. Validate the new prompt in pre-prod using the benchmark suite
   with a custom `MockProvider` fixture (`tests/fixtures/ai/`).
3. `POST /api/v1/admin/ai/prompts/{newId}/approve`. The previous
   approved row for the same `name` is atomically flipped to
   `deprecated`. From this moment the orchestrator picks the new
   row.
4. If a regression is detected, `POST /api/v1/admin/ai/prompts/{oldId}/rollback`
   re-approves the old row and demotes the current approved one.

`prompt_versions` enforces `(name, version)` uniqueness, so two
concurrent admin calls cannot accidentally create the same version.

## Confidence rules

`ConfidenceAggregator` (`App\Modules\AI/Services/ConfidenceAggregator.php`)
maps the overall `confidence` value (0..1) to a routing decision:

| confidence range | decision               | notes                                   |
| ---------------- | ---------------------- | --------------------------------------- |
| `> 0.95`         | `auto_route`           | M7 routes to the AI-recommended dept    |
| `0.80 .. 0.95`   | `moderator_review`     | High-confidence but flagged for sanity  |
| `< 0.80`         | `manual_classification`| Moderator picks the category themselves |

The three thresholds are constants on the class and can be overridden
at runtime via the constructor (used by tests to cover the
boundaries). `confidence = 0.80` and `confidence = 0.95` are inclusive
lower / exclusive upper bounds respectively — see the unit tests in
`tests/Unit/AI/ConfidenceAggregatorTest.php`.

`auto_route` is applied by `AiCompletedListener` (`App\Modules\AI\Listeners`),
**not** inside the pipeline job itself — the listener converts the
`AiCompleted` event's `confidence` (0..1) to the 0-100 scale
`ConfidenceAggregator` expects. Anything below `auto_route` transitions
the report to `pending_moderator` via the workflow engine's
`moderator_review` event and does **not** create a department
assignment — this is the concrete mechanism behind AGENTS.md's
"moderator always overrides AI" rule. The M7 routing engine still
evaluates the `routing_rules` DSL for the `auto_route` case, and a
moderator can always override a completed assignment afterward.

## PII masking

`PiiMaskingService` (`App\Modules\AI/Services/PiiMaskingService.php`)
runs **before** the request is sent to any provider. It:

- Drops top-level keys `mobile`, `email`, `token`, `address`,
  `phone`, `password` at any nesting depth.
- Rounds `latitude` / `longitude` to 2 decimals (≈1.1 km grid) so
  reports can still be geo-clustered without exposing the exact
  reporting location.
- Masks 10-digit Indian mobile numbers embedded in free text
  (e.g. in the citizen's `text` description).
- Emits a `pii.masked` log event with a key summary (no values) so
  forensic audit can see which keys were touched.

The service is immutable: it returns a new array and never mutates
the input. This is enforced by the unit test
`it does not mutate the input array`.

## Failover

`ProviderFailoverService` (`App\Modules\AI/Services/ProviderFailoverService.php`)
implements the failover rules in `docs/10` §18:

1. Load all `ai_provider_configs` rows with `active = true` and
   `is_fallback = false`, ordered by `priority ASC`.
2. For each candidate, call `healthCheck()`. The first healthy
   candidate wins.
3. If every primary candidate is unhealthy, fall back to the
   `is_fallback = true` row (currently `qwen-vl`).
4. If even the fallback is unhealthy, the job is marked `failed`
   with the last error and the report is routed to manual
   classification by the M6 workflow.

Provider-level errors do **not** crash the pipeline — every
`classify()` call is wrapped in a try/catch that records the
exception message on the `ai_jobs` row and proceeds to the next
candidate. This is verified by `tests/Feature/AI/ProviderFailoverTest.php`.

## Benchmark suite

`tests/Feature/AI/AiBenchmarkTest.php` is the regression net for the
provider abstraction. It runs `MockProvider` against a 50-case
fixture (`tests/fixtures/ai/benchmark_50.json`) and asserts:

- Every valid case produces an `AiResponse` that passes
  `AiResponseValidator` (i.e. conforms to the `docs/10` §14 schema).
- The provider's `primaryLabel()` matches `predicted_type` for
  every case.
- Every numeric field is in its declared range
  (confidence 0..1, scores 0..100, severity in the enum).
- The 5 negative cases (empty labels, no primary, two primary,
  invalid severity, out-of-range quality) are rejected by the
  validator with a named `reason` string in the exception context.

Run it locally:

```bash
cd backend
vendor/bin/pest tests/Feature/AI/AiBenchmarkTest.php
```

When adding a new provider, **add your case to the fixture** as a
positive or negative case and re-run the suite. The suite is the
fastest way to catch wire-format drift between providers.

## Configurability and security

- Provider secrets live in `ai_provider_configs.credentials`, an
  `encrypted:array` Eloquent cast (Laravel's built-in `APP_KEY`
  encryption) — the plaintext key never appears in a query log or a
  database dump taken without `APP_KEY`. `AiProviderFactory` is the
  only code that ever reads `credentials['api_key']`, at the moment
  it constructs the provider instance.
- The provider response is logged **without** the raw `raw` payload
  in production (`LOG_LEVEL=info`); the payload is only persisted
  in `ai_results.raw` for forensic / re-prompting use.
- `AiProviderConfigResource` masks `credentials` and surfaces a
  `has_secret` boolean instead. The OpenAPI schema enforces the
  same — see the `has_secret` field in
  `backend/storage/api-docs/openapi.yaml`.
- Every state change (prompt approve / rollback, provider CRUD)
  emits an audit log row and is visible in the Super Admin
  Audit Log UI.
- Citizen free text (title + description) is passed through
  `PiiMaskingService` before it reaches any provider — it drops
  PII-shaped keys and masks 10-digit Indian mobile numbers embedded
  in the text. It does **not** perform image redaction (no face
  detection or pixel-level PII stripping exists in this codebase);
  if a stakeholder-facing claim describes photo-level PII stripping,
  it is describing a feature that has not been built.

## Test coverage

| Test file                                       | What it covers                                          |
| ----------------------------------------------- | ------------------------------------------------------- |
| `tests/Feature/AI/AiBenchmarkTest.php`          | 50-case regression on the provider wire format          |
| `tests/Feature/AI/PipelineOrchestratorTest.php` | Full pipeline: queue, validator, persistence, event     |
| `tests/Feature/AI/ProviderFailoverTest.php`     | Primary → fallback → fail routing                       |
| `tests/Feature/AI/AiProviderCrudTest.php`       | Admin CRUD + secret masking + 403 + driver validation    |
| `tests/Feature/AI/AiProviderFactoryTest.php`    | `AiProviderFactory` builds the right class per driver    |
| `tests/Feature/AI/AiServiceProviderBindingTest.php` | Container-resolved `ProviderFailoverService` actually classifies, no manual test override |
| `tests/Feature/AI/AiPromptCrudTest.php`         | Admin CRUD + approve / rollback lifecycle               |
| `tests/Feature/AI/InternalProcessEndpointTest.php` | Internal endpoints (process, job, result)             |
| `tests/Feature/AI/ReportSubmitTriggersAiTest.php` | `ReportSubmittedListener` wires the pipeline          |
| `tests/Unit/AI/AiResponseValidatorTest.php`     | Schema validation, every named failure reason           |
| `tests/Unit/AI/ConfidenceAggregatorTest.php`    | Boundary cases at 0.80 and 0.95                        |
| `tests/Unit/AI/PiiMaskingServiceTest.php`       | Drops PII keys, rounds geo, masks text, no mutation     |
| `tests/Unit/AI/ImageQualityAnalyzerTest.php`    | Heuristic scoring for images / video / document         |
| `tests/Unit/AI/DuplicateDetectorTest.php`        | Perceptual-hash detection, 7-day window                 |
| `tests/Unit/AI/FraudScorerTest.php`             | Weighted-signal scoring, threshold of 75               |
| `tests/Feature/AI/MockProviderTest.php`         | Deterministic mock behaviour                            |
| `tests/Feature/AI/OpenAICompatibleProviderTest.php` | HTTP request shape + retry + backoff                |
| `tests/Feature/AI/QwenVLProviderTest.php`       | Per-URL media-type handling                             |
| `tests/Feature/AI/SeedersTest.php`              | Default providers and prompts seeders are idempotent    |
| `tests/Feature/AI/AICompletedEventTest.php`      | `AiCompleted` event payload contract                    |
| `tests/Feature/AI/*MigrationTest.php` (×3)      | Migration shape (UUID PKs, FKs, indexes)                |
| `tests/Feature/OpenApiAiTest.php`               | OpenAPI contract: paths, schemas, secret-masking        |

## Operational notes

- `AiProvidersSeeder` seeds `mock` as `active = true` and highest
  priority so a fresh dev/test environment never needs a real
  provider configured. **There is no environment guard that
  deactivates it automatically in production** — before going live,
  a Super Admin must explicitly deactivate `mock` and activate a
  real provider row (e.g. an `openai_compatible` row pointed at
  OpenRouter or Modal.com) from the AI Providers admin screen.
- The `ai_enabled` `app_configs` flag (docs/09 §18) is the platform
  kill-switch: when off, `AiPipelineOrchestrator` skips the provider
  call entirely and every report gets a zero-confidence
  "unclassified" result, which `ConfidenceAggregator` routes to
  `pending_moderator` — the same "non-AI path" referenced in
  `DEMO.md`'s Super Admin walkthrough.
- `ai_jobs.retention_days` (Super Admin setting, T-M8-009) is
  honoured by the daily `ai:purge-old-jobs` artisan command.
- Re-trigger the pipeline for a report by calling
  `POST /api/v1/internal/ai/process/{reportId}` from the system
  user; the moderator portal exposes this as a "Re-run AI" button
  (M10).
