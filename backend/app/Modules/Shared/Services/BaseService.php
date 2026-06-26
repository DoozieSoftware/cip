<?php

declare(strict_types=1);

namespace App\Modules\Shared\Services;

use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Throwable;

abstract class BaseService
{
    /**
     * @template T
     *
     * @param  callable():T  $work
     * @return T
     */
    protected function transaction(callable $work): mixed
    {
        /** @var T $result */
        $result = DB::transaction(static fn (): mixed => $work());

        return $result;
    }

    protected function emit(object $event): void
    {
        Event::dispatch($event);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    protected function logEvent(string $name, array $context = []): void
    {
        Log::info("event.{$name}", $context);
    }

    /**
     * @template T of Model
     *
     * @param  T|null  $model
     * @return T
     */
    protected function ensureExists(?Model $model, string $resource = 'Resource'): Model
    {
        if ($model === null) {
            throw ApiException::notFound($resource);
        }

        return $model;
    }

    /**
     * @template T
     *
     * @param  callable():T  $work
     * @return T
     */
    protected function tryOrFail(callable $work, ?Throwable $previous = null): mixed
    {
        try {
            /** @var T $result */
            $result = $work();

            return $result;
        } catch (ApiException $e) {
            throw $e;
        } catch (Throwable $e) {
            throw ApiException::serverError($e->getMessage(), $e);
        }
    }
}
