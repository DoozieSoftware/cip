<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Api;

use App\Modules\Reports\Http\Resources\ReportTypeResource;
use App\Modules\Reports\Repositories\ReportTypeRepository;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportTypeController extends BaseController
{
    public function __construct(
        private readonly ReportTypeRepository $repository,
    ) {}

    public function reportTypes(Request $request): JsonResponse
    {
        $types = $this->repository->active();

        return $this->respond(
            $types->map(static fn ($t): array => (new ReportTypeResource($t))->toArray($request))->all(),
        );
    }
}
