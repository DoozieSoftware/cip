<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Departments\Exports\DepartmentReportsExport;
use App\Modules\Departments\Repositories\DepartmentReportRepository;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * T-M11-010 — Department reports export endpoint.
 *
 *  GET /api/v1/department/reports/export?format=csv|xlsx|pdf
 *
 * Re-uses the same filter set as the list endpoint
 * (`status`, `priority`, `category`, `ward_id`, `date_from`,
 * `date_to`, `search`) so the export is in lockstep with
 * the on-screen list.
 *
 * Per docs/08 §25 the response is a downloadable file
 * with the correct Content-Type and Content-Disposition.
 * The implementation produces CSV / XLSX / PDF without
 * external packages so the milestone ships standalone;
 * `maatwebsite/excel` and `barryvdh/dompdf` can be wired
 * in later without changing the wire contract.
 */
class DepartmentReportExportController extends Controller
{
    public function __construct(private readonly DepartmentReportRepository $repo) {}

    public function export(Request $request): Response
    {
        $departmentId = $this->resolveDepartmentId($request);

        $format = strtolower((string) $request->query('format', DepartmentReportsExport::FORMAT_CSV));
        if (! in_array($format, DepartmentReportsExport::ALLOWED_FORMATS, true)) {
            throw new ApiException(
                'EXPORT_FORMAT_UNSUPPORTED',
                "Unsupported export format '{$format}'. Allowed: " . implode(', ', DepartmentReportsExport::ALLOWED_FORMATS),
                400,
            );
        }

        $filters = $request->query();
        // Cap at the repository maximum to keep the export
        // bounded — the list endpoint already enforces this
        // for the paginated view.
        $filters['per_page'] = DepartmentReportRepository::MAX_PER_PAGE;
        $filters['page'] = 1;

        // Run the same query the list endpoint uses, but
        // pull a full page so the export reflects the
        // filtered set.
        $page = $this->repo->assignedTo($departmentId, $filters);

        $filename = 'department-reports-' . now()->format('Ymd-His') . '-' . substr($departmentId, 0, 8);

        return DepartmentReportsExport::build($format, $page->getCollection(), $filename);
    }

    private function resolveDepartmentId(Request $request): string
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw new ApiException(401, 'UNAUTHENTICATED', 'Authentication required.');
        }
        if ($user->hasAnyRole(['super_admin', 'system']) && $request->filled('department_id')) {
            return (string) $request->string('department_id');
        }
        $dept = $user->departments()->first();
        if (! $dept) {
            throw new ApiException(403, 'NO_DEPARTMENT', 'User is not a member of any department.');
        }
        return (string) $dept->getKey();
    }
}
