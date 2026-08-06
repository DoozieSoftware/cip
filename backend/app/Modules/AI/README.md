# AI Module

## Purpose

Provides pluggable AI inference for report analysis. Supports image classification, fraud detection, duplicate detection, and evidence quality assessment. All AI providers implement a common interface; switching providers requires configuration only.

## Key Classes

| Class | Role |
|-------|------|
| `AIProviderInterface` | Contract all AI providers must implement |
| `AiProviderFactory` | Resolves the active provider from configuration |
| `ProviderFailoverService` | Handles provider fallback on failure |
| `AiPipelineOrchestrator` | Job that coordinates the full AI analysis pipeline |
| `FraudScorer` | Computes fraud probability from signals |
| `DuplicateDetector` | Identifies visually similar prior reports |
| `ImageQualityAnalyzer` | Assesses evidence clarity and usability |
| `PiiMaskingService` | Redacts PII before sending to external providers |
| `ConfidenceAggregator` | Combines scores from multiple signals |

## Providers

- `QwenVLProvider` — Qwen Vision-Language model
- `OpenAICompatibleProvider` — Any OpenAI-API-compatible endpoint

## Value Objects

- `AiRequest` — Immutable request payload
- `AiResponse` — Immutable provider response

## Dependencies

- `Reports` (Report model, media references)
- `Media` (evidence files for analysis)
- `Shared` (BaseController, error handling)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| POST | `/api/v1/internal/ai/process/{reportId}` | `api.v1.internal.ai.process` |
| GET | `/api/v1/internal/ai/job/{id}` | `api.v1.internal.ai.job` |
| GET | `/api/v1/internal/ai/job/{id}/result` | `api.v1.internal.ai.result` |
| GET | `/api/v1/admin/ai/providers` | `api.v1.admin.ai.providers.index` |
| POST | `/api/v1/admin/ai/providers` | `api.v1.admin.ai.providers.store` |
| PUT | `/api/v1/admin/ai/providers/{provider}` | `api.v1.admin.ai.providers.update` |
| POST | `/api/v1/admin/ai/providers/{provider}/test` | `api.v1.admin.ai.providers.test` |
| POST | `/api/v1/admin/ai/providers/{provider}/activate` | `api.v1.admin.ai.providers.activate` |
| GET | `/api/v1/admin/ai/prompts` | `api.v1.admin.ai.prompts.index` |
| POST | `/api/v1/admin/ai/prompts` | `api.v1.admin.ai.prompts.store` |
| POST | `/api/v1/admin/ai/prompts/{prompt}/approve` | `api.v1.admin.ai.prompts.approve` |
| POST | `/api/v1/admin/ai/prompts/{prompt}/rollback` | `api.v1.admin.ai.prompts.rollback` |

## Events

- `ReportSubmittedListener` — triggers AI pipeline on new report
- `AiCompletedListener` — dispatches notifications and workflow transitions
