<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Api;

use App\Modules\Reports\Http\Requests\SubmitReportRequest;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportsController extends BaseController
{
    public function __construct(
        private readonly ReportTypeController $reportTypeController,
        private readonly ReportSubmissionController $reportSubmissionController,
        private readonly CitizenReportController $citizenReportController,
        private readonly StaffReportController $staffReportController,
    ) {}

    public function reportTypes(Request $request): JsonResponse
    {
        return $this->reportTypeController->reportTypes($request);
    }

    public function store(SubmitReportRequest $request): JsonResponse
    {
        return $this->reportSubmissionController->store($request);
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        return $this->reportSubmissionController->submit($request, $id);
    }

    public function evidenceManifest(Request $request, string $id): JsonResponse
    {
        return $this->reportSubmissionController->manifest($request, $id);
    }

    public function finalize(Request $request, string $id): JsonResponse
    {
        return $this->reportSubmissionController->finalize($request, $id);
    }

    public function citizenDashboard(Request $request): JsonResponse
    {
        return $this->citizenReportController->citizenDashboard($request);
    }

    public function citizenIndex(Request $request): JsonResponse
    {
        return $this->citizenReportController->citizenIndex($request);
    }

    public function citizenShow(Request $request, string $id): JsonResponse
    {
        return $this->citizenReportController->citizenShow($request, $id);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->staffReportController->index($request);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return $this->staffReportController->show($request, $id);
    }

    public function timeline(Request $request, string $id): JsonResponse
    {
        return $this->staffReportController->timeline($request, $id);
    }
}
