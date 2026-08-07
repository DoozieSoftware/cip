<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Users\Models\User;
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
    public function listForReport(string $reportId, ?User $user, Request $request): Collection
    {
        $isStaffReader = $user?->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system']) ?? false;

        $query = Media::query()
            ->where('report_id', $reportId)
            ->orderBy('created_at');

        if (! $isStaffReader) {
            $query->where('role', 'evidence');
        }

        $media = $query->get();

        foreach ($media as $m) {
            $this->chainOfCustody->recordFromRequest($m, ChainOfCustodyWriter::EVENT_VIEW, $request);
        }

        return $media;
    }

    public function isStaff(?User $user): bool
    {
        return $user?->hasRole('super_admin') ?? false;
    }
}
