<?php

declare(strict_types=1);

namespace App\Modules\Public\Http\Controllers;

use App\Modules\Public\Services\ReverseGeocodeService;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicReverseGeocodeController extends BaseController
{
    public function __construct(private readonly ReverseGeocodeService $service) {}

    public function __invoke(Request $request): JsonResponse
    {
        $request->validate(['lat' => ['required', 'numeric', 'between:-90,90'], 'lng' => ['required', 'numeric', 'between:-180,180']]);

        return $this->respond($this->service->resolve($request->float('lat'), $request->float('lng')));
    }
}
