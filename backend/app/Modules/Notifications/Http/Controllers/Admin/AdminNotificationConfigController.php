<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Admin;

use App\Modules\Notifications\Http\Requests\Admin\StoreNotificationChannelConfigRequest;
use App\Modules\Notifications\Http\Requests\Admin\UpdateNotificationChannelConfigRequest;
use App\Modules\Notifications\Http\Resources\NotificationChannelConfigResource;
use App\Modules\Notifications\Models\NotificationChannelConfig;
use App\Modules\Notifications\Repositories\NotificationChannelConfigRepository;
use App\Modules\Notifications\Services\NotificationChannelConfigService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-009 — Super Admin CRUD for notification channel
 * configs per `docs/09` §16.
 *
 *  - GET    /api/v1/admin/notification-configs
 *  - POST   /api/v1/admin/notification-configs
 *  - GET    /api/v1/admin/notification-configs/{config}
 *  - PUT    /api/v1/admin/notification-configs/{config}
 *  - DELETE /api/v1/admin/notification-configs/{config}
 *  - POST   /api/v1/admin/notification-configs/{config}/restore
 *
 * Secrets (`credentials`) are masked on every read; writes
 * are accepted in clear and persisted as JSON.
 */
class AdminNotificationConfigController extends BaseController
{
    public function __construct(
        private readonly NotificationChannelConfigRepository $repository,
        private readonly NotificationChannelConfigService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $filters = [
            'q' => $request->query('q'),
            'channel' => $request->query('channel'),
            'active' => $request->query('active') === null
                ? null
                : filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->search($filters, (int) $request->query('per_page', 25));
        $transformed = $page->through(
            static fn (NotificationChannelConfig $c): array => (new NotificationChannelConfigResource($c))->toArray($request),
        );

        return $this->respondPaginated($transformed);
    }

    public function store(StoreNotificationChannelConfigRequest $request): JsonResponse
    {
        $row = $this->service->create($request->validated());

        return $this->respond(
            (new NotificationChannelConfigResource($row))->toArray($request),
            'Notification channel config created.',
            201,
        );
    }

    public function show(Request $request, string $config): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($config, withTrashed: true);

        return $this->respond((new NotificationChannelConfigResource($row))->toArray($request));
    }

    public function update(UpdateNotificationChannelConfigRequest $request, string $config): JsonResponse
    {
        $row = $this->find($config);
        $updated = $this->service->update($row, $request->validated());

        return $this->respond(
            (new NotificationChannelConfigResource($updated))->toArray($request),
            'Notification channel config updated.',
        );
    }

    public function destroy(Request $request, string $config): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($config);
        $this->service->delete($row);

        return $this->respond(null, 'Notification channel config deleted.', 200);
    }

    public function restore(Request $request, string $config): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($config, withTrashed: true);

        if ($row->deleted_at === null) {
            throw ApiException::conflict('Notification channel config is not deleted.');
        }

        $restored = $this->service->restore($row);

        return $this->respond(
            (new NotificationChannelConfigResource($restored))->toArray($request),
            'Notification channel config restored.',
        );
    }

    private function find(string $id, bool $withTrashed = false): NotificationChannelConfig
    {
        $q = NotificationChannelConfig::query();

        if ($withTrashed) {
            $q->withTrashed();
        }
        $row = $q->where('id', $id)->first();

        if ($row === null) {
            throw ApiException::notFound('Notification channel config');
        }

        return $row;
    }
}
