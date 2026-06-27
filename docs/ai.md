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
 ┌──────────────────────────────────────────┐
 │  1. PiiMaskingService.mask(metadata, …)  │
 │  2. ImageQualityAnalyzer.score(media)    │
 │  3. DuplicateDetector.detect(report)     │
 │  4. FraudScorer.score(events)            │
 │  5. provider.classify(AiRequest)         │
 │  6. AiResponseValidator.validate(resp)   │
 │  7. ConfidenceAggregator.decide(conf)    │
 │  8. persist ai_jobs / ai_results / labels│
 │  9. emit AiCompleted                    │
 └──────────────────────────────────────────┘
        │
        ▼
   report → moderator_review | auto_route | manual_classification
```

The pipeline is the single integration point between the rest of the
platform and any AI provider. It is implemented in
`backend/app/Modules/AI/Jobs/AiPipelineOrchestrator.php` and is
unit-tested in `tests/Feature/AI/PipelineOrchestratorTest.php`.

## Endpoints

| Method | Path                                                | Audience                    | Notes                                          |
| ------ | --------------------------------------------------- | --------------------------- | ---------------------------------------------- |
| GET    | `/api/v1/admin/ai/providers`                        | Super Admin                 | Paginated list                                 |
| POST   | `/api/v1/admin/ai/providers`                        | Super Admin                 | Create provider config                         |
| GET    | `/api/v1/admin/ai/providers/{provider}`             | Super Admin                 | Single provider (secrets masked)               |
| PUT    | `/api/v1/admin/ai/providers/{provider}`             | Super Admin                 | Partial update                                 |
| DELETE | `/api/v1/admin/ai/providers/{provider}`             | Super Admin                 | Remove provider                                |
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

- `ai_provider_configs` (T-M8-006)
  - `id`, `code` (unique), `name`, `base_url`, `auth_type` enum
    `{none, bearer, api_key, oauth}`
  - `api_key_secret_id` (nullable UUID; **never serialized** — see
    `AiProviderConfigResource`)
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

Three implementations ship in M8:

| Code       | Class                              | When to use                                      |
| ---------- | ---------------------------------- | ------------------------------------------------ |
| `mock`     | `App\Modules\AI\Providers\MockProvider` | dev, test, and CI (no external calls)        |
| `openai`   | `App\Modules\AI\Providers\OpenAICompatibleProvider` | any OpenAI-compatible API (base_url + bearer) |
| `qwen-vl`  | `App\Modules\AI\Providers\QwenVLProvider` | Alibaba Qwen-VL; supports image+video URLs   |

All three read their config from `ai_provider_configs` at request time
via the DI container, so swapping providers in production requires
**zero code changes** — only a Super Admin CRUD call.

### Adding a new provider without code changes

The platform supports adding a new OpenAI-compatible vision provider
end-to-end without writing any PHP:

1. **Seed a new row** in `ai_provider_configs` (or use the Super
   Admin API):
   - `code`: e.g. `azure-gpt4v`
   - `name`: human-readable label
   - `base_url`: e.g. `https://my-resource.openai.azure.com/openai/deployments/gpt4v/`
   - `auth_type`: `bearer` (or `api_key`)
   - `api_key_secret_id`: UUID of the secret in the secrets vault
   - `model`: the upstream model id
   - `temperature`, `timeout_ms`, `retry_count`: tuning knobs
   - `priority`: lower than your current primary to keep `mock` /
     existing primary winning by default
   - `active`: `true`
2. **Bind it in code** by registering the slug in
   `AppServiceProvider::registerAiProviders()` against
   `OpenAICompatibleProvider` (the default generic adapter):

   ```php
   $this->app->bind('ai.provider.azure-gpt4v', fn () => new OpenAICompatibleProvider(
       name: 'azure-gpt4v',
       model: config('ai.providers.azure-gpt4v.model'),
       config: AiProviderConfig::where('code', 'azure-gpt4v')->firstOrFail(),
   ));
   ```
3. **Update the provider factory** (`AiProviderFactory::make()`) to
   map the new `code` to that binding. This is a one-line addition.
4. **Test it** by running the benchmark suite against the new code
   (`AiBenchmarkTest`) — every case must still validate.

If the new provider speaks a wire format that is **not**
OpenAI-compatible, write a small `MyProvider` class implementing
`AIProviderInterface` (typically < 100 lines) and bind it the same
way. The orchestrator, validator, and aggregator do not need to
change.

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

`auto_route` is **advisory** — the M7 routing engine still evaluates
the `routing_rules` DSL and the moderator can override.

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

- All provider secrets live in the secrets vault; only the
  `api_key_secret_id` UUID is stored in `ai_provider_configs`. The
  secret value is never read by the AI module — the provider
  implementations fetch it on demand through
  `SecretService::reveal($apiKeySecretId)`.
- The provider response is logged **without** the raw `raw` payload
  in production (`LOG_LEVEL=info`); the payload is only persisted
  in `ai_results.raw` for forensic / re-prompting use.
- `AiProviderConfigResource` masks `api_key_secret_id` and surfaces
  a `has_secret` boolean instead. The OpenAPI schema enforces the
  same — see the `has_secret` field in
  `backend/storage/api-docs/openapi.yaml`.
- Every state change (prompt approve / rollback, provider CRUD)
  emits an audit log row and is visible in the Super Admin
  Audit Log UI.

## Test coverage

| Test file                                       | What it covers                                          |
| ----------------------------------------------- | ------------------------------------------------------- |
| `tests/Feature/AI/AiBenchmarkTest.php`          | 50-case regression on the provider wire format          |
| `tests/Feature/AI/PipelineOrchestratorTest.php` | Full pipeline: queue, validator, persistence, event     |
| `tests/Feature/AI/ProviderFailoverTest.php`     | Primary → fallback → fail routing                       |
| `tests/Feature/AI/AiProviderCrudTest.php`       | Admin CRUD + secret masking + 403                       |
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

- The default `mock` provider is the dev / test default per
  `AiProvidersSeeder` — production deployments should set
  `APP_ENV=production` so the `ProviderFailoverService` skips
  `mock` (it is forced to `active = false` in prod by the same
  seeder guard).
- `ai_jobs.retention_days` (Super Admin setting, T-M8-009) is
  honoured by the daily `ai:purge-old-jobs` artisan command.
- Re-trigger the pipeline for a report by calling
  `POST /api/v1/internal/ai/process/{reportId}` from the system
  user; the moderator portal exposes this as a "Re-run AI" button
  (M10).
