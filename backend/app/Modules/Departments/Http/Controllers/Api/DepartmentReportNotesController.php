<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Modules\Departments\Http\Requests\StoreInternalNoteRequest;
use App\Modules\Departments\Http\Resources\InternalNoteResource;
use App\Modules\Departments\Services\DepartmentReportService;
use App\Modules\Departments\Services\OperationDepartmentResolver;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentReportNotesController
{
    public function __construct(
        private readonly DepartmentReportService $service,
        private readonly OperationDepartmentResolver $departments,
    ) {}

    public function addNote(Report $report, StoreInternalNoteRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $body = $request->input('body');
        $note = $this->service->addNote(
            $report,
            $user,
            is_string($body) ? $body : '',
            $request,
            $this->resolveDepartmentId($request, $user, $report->department_id),
        );

        return response()->json([
            'success' => true,
            'data' => (new InternalNoteResource($note->load('author')))->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ], 201);
    }

    public function listNotes(Report $report, Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $notes = $report->internalNotes()
            ->where('department_id', $this->resolveDepartmentId($request, $user, $report->department_id))
            ->with('author')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => InternalNoteResource::collection($notes)->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }

    private function resolveDepartmentId(Request $request, User $user, ?string $fallback = null): string
    {
        $requested = $request->query('department_id');

        if (
            (! is_string($requested) || $requested === '')
            && $fallback !== null
            && $user->hasAnyRole(['super_admin', 'system'])
        ) {
            return $fallback;
        }

        return $this->departments
            ->resolve($user, is_string($requested) && $requested !== '' ? $requested : null)
            ->id;
    }
}
