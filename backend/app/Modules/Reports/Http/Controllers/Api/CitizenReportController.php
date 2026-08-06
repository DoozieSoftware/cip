<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Api;

use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Repositories\ReportRepository;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CitizenReportController extends BaseController
{
    public function __construct(
        private readonly ReportRepository $repository,
    ) {}

    public function citizenDashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $counts = $this->repository->citizenDashboardCounts((string) $user->id);

        return $this->respond($counts);
    }

    public function citizenIndex(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $filters = [
            'status' => $request->query('status'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'search' => $request->query('q'),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->searchForCitizen($user, $filters, perPage: (int) $request->query('per_page', 25));

        $items = $page->getCollection()
            ->map(static fn (Report $r): array => (new ReportResource($r))->toArray($request))
            ->values()
            ->all();

        return $this->respond($items, 'OK', 200, [
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    public function citizenShow(Request $request, string $id): JsonResponse
    {
        $report = $this->repository->findById($id);

        if ($report === null) {
            throw ApiException::notFound('Report');
        }

        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;

        if (! $isOwner && ! $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system'])) {
            throw ApiException::forbidden('You cannot view this report.');
        }

        if (! $isOwner) {
            $this->assertDepartmentScopeAllows($user, $report);
        }

        return $this->respond(
            (new ReportResource($report->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
        );
    }

    private function assertDepartmentScopeAllows(User $user, Report $report): void
    {
        if (! DepartmentScope::canViewReport($user, $report)) {
            throw ApiException::forbidden('This report is outside your department scope.');
        }
    }
}
