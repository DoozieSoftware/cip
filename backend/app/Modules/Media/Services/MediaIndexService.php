<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

class MediaIndexService
{
    public function __construct(
        private readonly ChainOfCustodyWriter $chainOfCustody,
    ) {}

    /**
     * @return Collection<int, Media>
     */
    public function listForReport(
        string $reportId,
        ?User $user,
        Request $request,
        ?string $selectedDepartmentId = null,
        bool $includeCitizenOutcomeProof = false,
    ): Collection {
        $query = Media::query()
            ->where('report_id', $reportId)
            ->where('scan_status', MediaScanStatus::CLEAN->value)
            ->orderBy('created_at');

        $this->applyVisibilityScope(
            $query,
            $reportId,
            $user,
            $selectedDepartmentId,
            $includeCitizenOutcomeProof,
        );

        $media = $query->get();

        foreach ($media as $m) {
            $this->chainOfCustody->recordFromRequest(
                $m,
                ChainOfCustodyWriter::EVENT_VIEW,
                $request,
                [
                    'selected_department_id' => $selectedDepartmentId,
                    'authorization_scope' => $this->authorizationScope($user),
                ],
            );
        }

        return $media;
    }

    public function isStaff(?User $user): bool
    {
        return $user?->hasRole('super_admin') ?? false;
    }

    /** @param  Builder<Media>  $query */
    private function applyVisibilityScope(
        Builder $query,
        string $reportId,
        ?User $user,
        ?string $selectedDepartmentId,
        bool $includeCitizenOutcomeProof,
    ): void {
        if ($user === null) {
            $query->where('role', 'evidence');

            return;
        }

        if (DepartmentScope::isUnrestrictedStaff($user)) {
            return;
        }

        if (DepartmentScope::isDepartmentScopedStaff($user)) {
            $memberDepartmentIds = DepartmentScope::memberDepartmentIds($user);
            $proofDepartmentIds = $selectedDepartmentId !== null
                && in_array($selectedDepartmentId, $memberDepartmentIds, true)
                ? [$selectedDepartmentId]
                : $memberDepartmentIds;
            $reportDepartmentId = Report::query()
                ->whereKey($reportId)
                ->value('department_id');

            $query->where(function (Builder $visibility) use ($proofDepartmentIds, $reportDepartmentId): void {
                $visibility->where('role', 'evidence');

                if ($proofDepartmentIds === []) {
                    return;
                }

                $visibility->orWhere(function (Builder $proof) use ($proofDepartmentIds, $reportDepartmentId): void {
                    $proof->where('role', 'proof')
                        ->where(function (Builder $owner) use ($proofDepartmentIds, $reportDepartmentId): void {
                            $owner->whereIn('department_id', $proofDepartmentIds);

                            // Legacy proof created before assignment ownership
                            // was introduced is visible only to the report's
                            // primary agency, never to a linked agency.
                            if (
                                is_string($reportDepartmentId)
                                && in_array($reportDepartmentId, $proofDepartmentIds, true)
                            ) {
                                $owner->orWhere(function (Builder $legacy): void {
                                    $legacy->whereNull('department_id')
                                        ->whereNull('assignment_id');
                                });
                            }
                        });
                });
            });

            return;
        }

        $reportCitizenId = Report::query()->whereKey($reportId)->value('citizen_id');
        $isOwner = is_string($reportCitizenId)
            && (string) $user->getKey() === $reportCitizenId;

        if (! $includeCitizenOutcomeProof || ! $isOwner) {
            $query->where('role', 'evidence');
        }
    }

    private function authorizationScope(?User $user): string
    {
        if ($user === null) {
            return 'anonymous';
        }

        if (DepartmentScope::isUnrestrictedStaff($user)) {
            return 'unrestricted_staff';
        }

        if (DepartmentScope::isDepartmentScopedStaff($user)) {
            return 'department';
        }

        return 'citizen';
    }
}
