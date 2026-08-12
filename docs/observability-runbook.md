# Observability Runbook

This runbook is the minimum production response procedure for tracing an API
request through queued work and connector calls. It is intentionally free of
credentials and can be used by an on-call operator with read-only access.

## Correlate a request

1. Copy the `X-Request-Id` response header (or the `trace_id` field in the API
   envelope) from the citizen, moderator, or admin report.
2. Search the centralized application log for `trace_id=<value>`.
3. If the request dispatched asynchronous work, search the worker log with the
   same value. Queue payloads carry the id automatically, including retries.
4. Connector requests include the same value in their `X-Request-Id` header;
   use the upstream provider's request log to continue the trace.

Never paste access tokens, OTPs, evidence URLs, or provider credentials into an
incident ticket. Record only the correlation id, timestamps, endpoint, queue,
and sanitized error code.

## Check platform health

Run the liveness and readiness probes from the deployment host or monitoring
system:

```text
GET /api/v1/health
GET /api/v1/health/ready
```

`/health` confirms the process is serving traffic. `/health/ready` also checks
database, cache, queue, object storage, malware scanner, and worker/scheduler
heartbeats. A non-200 readiness response should remove the instance from
traffic while the dependency is investigated; do not restart all workers at
once.

For an authenticated platform view, use the admin health endpoints:

```text
GET /api/v1/admin/health
GET /api/v1/admin/health/components
```

These responses are sanitized for operations and must not be exposed publicly.

## Queue or SLA incident

1. Check readiness and the queue-specific heartbeat/oldest-job age.
2. Use the report's correlation id to distinguish a slow connector from a
   stalled worker.
3. If only one queue is unhealthy, restart that queue's worker group and watch
   the heartbeat recover before touching other queues.
4. If SLA breaches are accumulating, verify the scheduler heartbeat and the
   `workflow:check-sla-breaches` schedule before replaying jobs.
5. Preserve failed-job payloads and logs for reconciliation. Do not delete
   evidence or audit rows as a recovery step.

After recovery, record the affected queue, start/end timestamps, correlation
ids, dependency status, and the corrective action in the incident log.
