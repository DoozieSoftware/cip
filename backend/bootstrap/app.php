<?php

declare(strict_types=1);

use App\Modules\Security\Http\Middleware\AuditMiddleware;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Middleware\RequestId;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(RequestId::class);
        $middleware->append(AuditMiddleware::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // ValidationException → 422 with the standard envelope and the
        // first message as the top-level message + errors map.
        $exceptions->render(function (ValidationException $e, Request $request) {
            $payload = [
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
                'code' => 'VALIDATION_FAILED',
                'trace_id' => (string) ($request->attributes->get('trace_id')
                    ?? $request->header('X-Request-Id')
                    ?? 'unknown'),
            ];

            return response()->json($payload, 422);
        });

        // ApiException → standard error envelope with trace_id.
        $exceptions->render(function (ApiException $e, Request $request) {
            $payload = [
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => $e->details,
                'code' => $e->errorCode,
                'trace_id' => (string) ($request->attributes->get('trace_id')
                    ?? $request->header('X-Request-Id')
                    ?? 'unknown'),
            ];

            if ($payload['errors'] === []) {
                $payload['errors'] = (object) [];
            }

            return response()->json($payload, $e->httpStatus);
        });

        // AuthenticationException -> 401 with the standard envelope.
        // auth:sanctum, auth:web, etc. all throw this when the guard
        // cannot resolve a user (missing/invalid/revoked bearer, no
        // session). Per docs/05 s5 and docs/11 s6 every protected
        // endpoint must reply 401 (not 500) in this case.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            $traceId = (string) ($request->attributes->get('trace_id')
                ?? $request->header('X-Request-Id')
                ?? 'unknown');
            $payload = [
                'success' => false,
                'message' => $e->getMessage() !== '' ? $e->getMessage() : 'Unauthenticated.',
                'errors' => (object) [],
                'code' => 'UNAUTHORIZED',
                'trace_id' => $traceId,
            ];

            return response()->json($payload, 401);
        });

        // Any other Throwable under API requests → opaque 500 with trace_id.
        // Never leak stack traces to clients (docs/03 §20).
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }
            $traceId = (string) ($request->attributes->get('trace_id')
                ?? $request->header('X-Request-Id')
                ?? 'unknown');
            $payload = [
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'errors' => (object) [],
                'code' => 'INTERNAL_ERROR',
                'trace_id' => $traceId,
            ];
            $status = $e instanceof HttpExceptionInterface
                ? $e->getStatusCode()
                : Response::HTTP_INTERNAL_SERVER_ERROR;

            return response()->json($payload, $status);
        });
    })->create();
