<?php

declare(strict_types=1);

namespace App\Modules\Security\Http\Middleware;

use App\Modules\Security\Models\AuditLog;
use App\Modules\Security\Services\DeviceFingerprintService;
use App\Modules\Shared\Exceptions\ModelImmutableException;
use App\Modules\Users\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Audit middleware.
 *
 * Per docs/03 §19 and docs/11 §28. Wraps every mutating API
 * request (POST, PUT, PATCH, DELETE) and writes exactly one row to
 * the `audit_logs` table after the response is built. The row
 * captures: actor (user_id or null), entity, entity_id, action,
 * before / after snapshots, IP, device fingerprint, request id.
 *
 * Two ways for a controller / service to enrich the audit row:
 *
 *  1. **Route-level convention.** When the route has a route
 *     parameter bound to a model, the middleware uses:
 *       - entity   = the parameter name (or the override stored in
 *                    the request attribute `audit.entity`)
 *       - entity_id = the model key
 *       - before   = `$model->toArray()` (only when the model
 *                    exists, i.e. PUT/PATCH/DELETE)
 *       - after    = `$model->fresh()->toArray()` after the
 *                    controller has run, when available
 *       - action   = the verb (POST/PUT/PATCH/DELETE), lower-cased
 *
 *  2. **Request attribute API.** A controller can attach custom
 *     values via the request attributes:
 *       - $request->attributes->set('audit.entity', 'auth')
 *       - $request->attributes->set('audit.entity_id', $user->id)
 *       - $request->attributes->set('audit.action', 'login')
 *       - $request->attributes->set('audit.before', [...])
 *       - $request->attributes->set('audit.after', [...])
 *
 * When the controller throws, the middleware still records an
 * audit row with action `error.<verb>` and no after-snapshot, so
 * every attempted mutation is captured (including denials).
 *
 * The middleware is intentionally fail-open: if the audit insert
 * itself fails, the original response is still returned to the
 * client. The failure is surfaced through the standard Log channel
 * and through a `X-Audit-Status: failed` response header so
 * observability can pick it up.
 */
class AuditMiddleware
{
    public function __construct(
        private readonly DeviceFingerprintService $fingerprints,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->isMutating($request)) {
            /** @var Response $response */
            /** @var Response $response */
            /** @var Response $response */
            /** @var Response $response */
            $response = $next($request);

            return $response;
        }

        $before = null;
        $entity = $this->resolveEntity($request);
        $entityId = $this->resolveEntityId($request);
        $action = $this->resolveAction($request);

        if ($entity !== null && $entityId !== null && in_array($request->getMethod(), ['PUT', 'PATCH', 'DELETE'], true)) {
            $before = $this->snapshotRouteModel($request, $entity);
        } else {
            /** @var array<string, mixed>|null $before */
            $before = $this->readAuditAttribute($request, 'before');
        }

        /** @var Response $response */
        $response = $next($request);

        /** @var array<string, mixed>|null $after */
        $after = $this->resolveAfter($request, $entity, $entityId, $response);

        $this->writeAuditRow($request, $entity, $entityId, $action, $before, $after, $response);

        return $response;
    }

    private function isMutating(Request $request): bool
    {
        return in_array($request->getMethod(), ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    }

    private function resolveEntity(Request $request): ?string
    {
        /** @var mixed $override */
        $override = $this->readAuditAttribute($request, 'entity');

        if (is_string($override) && $override !== '') {
            return $override;
        }

        $route = $request->route();

        if ($route === null) {
            return null;
        }

        foreach ($route->parameters() as $name => $value) {
            if ($value instanceof Model) {
                return (string) $name;
            }
        }

        return null;
    }

    private function resolveEntityId(Request $request): ?string
    {
        /** @var mixed $override */
        $override = $this->readAuditAttribute($request, 'entity_id');

        if (is_string($override) && $override !== '') {
            return $override;
        }

        $route = $request->route();

        if ($route === null) {
            return null;
        }

        foreach ($route->parameters() as $name => $value) {
            if ($value instanceof Model) {
                $key = $value->getKey();

                if (is_string($key) || is_int($key)) {
                    return (string) $key;
                }
            }
        }

        return null;
    }

    private function resolveAction(Request $request): string
    {
        /** @var mixed $override */
        $override = $this->readAuditAttribute($request, 'action');

        if (is_string($override) && $override !== '') {
            return $override;
        }

        return strtolower($request->getMethod());
    }

    /**
     * @return array<string, mixed>|null
     */
    private function snapshotRouteModel(Request $request, string $entity): ?array
    {
        $route = $request->route();

        if ($route === null) {
            return null;
        }

        $model = $route->parameter($entity);

        if (! $model instanceof Model) {
            return null;
        }

        /** @var array<string, mixed> $arr */
        $arr = $model->toArray();

        return $arr;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveAfter(Request $request, ?string $entity, ?string $entityId, Response $response): ?array
    {
        /** @var mixed $override */
        $override = $this->readAuditAttribute($request, 'after');

        if ($override !== null) {
            /** @var array<string, mixed>|null $override */
            return is_array($override) ? $override : null;
        }

        if ($response->getStatusCode() >= 400) {
            return null;
        }

        if ($entity === null || $entityId === null) {
            return null;
        }

        if (! in_array($request->getMethod(), ['POST', 'PUT', 'PATCH'], true)) {
            return null;
        }

        $route = $request->route();

        if ($route === null) {
            return null;
        }

        $model = $route->parameter($entity);

        if (! $model instanceof Model) {
            return null;
        }

        $fresh = $model->fresh();

        if ($fresh === null) {
            return null;
        }

        /** @var array<string, mixed> $arr */
        $arr = $fresh->toArray();

        return $arr;
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    private function writeAuditRow(
        Request $request,
        ?string $entity,
        ?string $entityId,
        string $action,
        ?array $before,
        ?array $after,
        Response $response,
    ): void {
        try {
            /** @var array{user_agent: ?string, screen: ?string, timezone: ?string, language: ?string, canvas: ?string, webgl: ?string, ip: ?string, hash: string} $fp */
            /** @var array{user_agent: ?string, screen: ?string, timezone: ?string, language: ?string, canvas: ?string, webgl: ?string, ip: ?string, hash: string} $fp */
            $fp = $this->fingerprints->fromRequest($request);

            $row = new AuditLog;
            $row->user_id = $this->resolveUserId($request);
            $row->entity = $entity ?? 'request';
            $row->entity_id = $entityId;
            $row->action = $response->getStatusCode() >= 400 ? "error.{$action}" : $action;
            $row->before = $before;
            $row->after = $after;
            /** @var string|null $ip */ $ip = $fp['ip'];
            /** @var string $hash */ $hash = $fp['hash'];
            $row->ip = $ip !== null && $ip !== '' ? $ip : null;
            $row->device_fingerprint = $hash !== '' ? $hash : null;
            /** @var mixed $traceId */
            $traceId = $request->attributes->get('trace_id') ?? $request->header('X-Request-Id') ?? '';
            $traceIdStr = is_string($traceId) ? $traceId : (is_scalar($traceId) ? (string) $traceId : '');
            $row->request_id = $traceIdStr !== '' ? $traceIdStr : null;
            $row->created_at = now();
            $row->save();

            $response->headers->set('X-Audit-Id', (string) $row->id);
            $response->headers->set('X-Audit-Status', 'ok');
        } catch (ModelImmutableException $e) {
            $this->logFailure($request, $e);
            $response->headers->set('X-Audit-Status', 'failed');
        } catch (Throwable $e) {
            $this->logFailure($request, $e);
            $response->headers->set('X-Audit-Status', 'failed');
        }
    }

    private function resolveUserId(Request $request): ?string
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return null;
        }

        $key = $user->getKey();

        return is_string($key) || is_int($key) ? (string) $key : null;
    }

    private function readAuditAttribute(Request $request, string $key): mixed
    {
        return $request->attributes->get("audit.{$key}");
    }

    private function logFailure(Request $request, Throwable $e): void
    {
        Log::warning('audit.write_failed', [
            'request_id' => $request->attributes->get('trace_id'),
            'method' => $request->getMethod(),
            'path' => $request->path(),
            'error' => $e->getMessage(),
        ]);
    }
}
