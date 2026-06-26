<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Contracts\View\View;

class ApiDocumentationController extends BaseController
{
    public function show(): View
    {
        $disk = self::asString(config('filesystems.default'), 'local');
        $url = url('storage/api-docs/openapi.yaml');

        if ($disk === 'local') {
            $url = url('api/v1/openapi.yaml');
        }

        return view('api.documentation', ['openApiUrl' => $url]);
    }

    private static function asString(mixed $value, string $fallback): string
    {
        return is_string($value) && $value !== '' ? $value : $fallback;
    }
}
