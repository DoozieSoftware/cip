<?php

declare(strict_types=1);

namespace App\Modules\Shared\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RequestId
{
    public const ATTRIBUTE = 'trace_id';

    public const HEADER = 'X-Request-Id';

    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->header(self::HEADER) ?: (string) Str::uuid();
        $request->attributes->set(self::ATTRIBUTE, $id);
        $request->headers->set(self::HEADER, $id);

        if (Log::getFacadeRoot() !== null) {
            Log::withContext([self::ATTRIBUTE => $id]);
        }

        try {
            $response = $next($request);
            $response->headers->set(self::HEADER, $id);

            return $response;
        } finally {
            // Workers may serve multiple requests in one process. Never leak
            // one request's id into the next request's log context.
            if (Log::getFacadeRoot() !== null) {
                Log::withoutContext([self::ATTRIBUTE]);
            }
        }
    }
}
