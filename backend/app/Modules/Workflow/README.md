# Workflow Module

## Purpose

Implements the configurable state machine that governs report lifecycle. Defines workflow definitions, states, transitions, and guards. Evaluates conditions and enforces permissions for state changes. Monitors SLA breaches.

## Key Classes

| Class | Role |
|-------|------|
| `WorkflowEngine` | Executes transitions and evaluates conditions |
| `WorkflowAdminService` | CRUD for workflow definitions |
| `TransitionGuard` | Enforces role/permission checks on transitions |
| `ConditionEvaluator` | Evaluates transition conditions |
| `WorkflowRepository` | Persistence for workflow records |
| `WorkflowAdminController` | Admin endpoints for workflow management |
| `CheckSlaBreaches` | Scheduled job for SLA monitoring |

## Models

- `WorkflowDefinition` — named workflow template
- `WorkflowState` — individual states within a workflow
- `WorkflowTransition` — allowed transitions with role/condition rules

## Value Objects

- `WorkflowDecision` — Immutable transition result

## Exceptions

- `InvalidTransitionException` — transition not defined
- `UnauthorizedTransitionException` — role lacks permission

## Events

- `SlaBreached` — emitted when a report exceeds its SLA

## Dependencies

- `Reports` (Report model, status field)
- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/admin/workflows` | `api.v1.admin.workflows.index` |
| POST | `/api/v1/admin/workflows` | `api.v1.admin.workflows.store` |
| GET | `/api/v1/admin/workflows/{workflow}` | `api.v1.admin.workflows.show` |
| PUT | `/api/v1/admin/workflows/{workflow}` | `api.v1.admin.workflows.update` |
| DELETE | `/api/v1/admin/workflows/{workflow}` | `api.v1.admin.workflows.destroy` |
