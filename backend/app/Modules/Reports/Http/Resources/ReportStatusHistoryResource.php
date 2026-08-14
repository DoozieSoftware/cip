<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Reports\Models\ReportStatusHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ReportStatusHistoryResource — the API representation of a single
 * status transition row. Used by the timeline endpoint.
 *
 * @property-read ReportStatusHistory $resource
 */
class ReportStatusHistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $row = $this->resource;

        $fromName = $row->fromStatus->name;
        $toName = $row->toStatus->name ?? 'updated';
        $event = $fromName !== null
            ? "Status changed from {$fromName} to {$toName}"
            : "Report {$toName}";

        // `reason` may carry an internal workflow-transition key
        // (e.g. "workflow.transition:<uuid>"); the real transition id
        // already lives in `metadata.transition_id`. Never surface the
        // machine key to users — only expose genuine human notes.
        $reason = $row->reason;
        $note = is_string($reason) && str_starts_with($reason, 'workflow.transition:')
            ? null
            : $reason;

        // Every account — including staff — also carries the baseline
        // `citizen` role, and `getRoleNames()` has no defined order. Picking
        // an arbitrary role would sometimes report a moderator's own action
        // as `citizen`, which a citizen client renders as "You" — telling
        // the citizen they did something staff actually did. Rank the most
        // specific/privileged role highest so it always wins.
        $actorRoles = $row->actor?->getRoleNames() ?? collect();
        $actorRole = self::highestPriorityRole($actorRoles->all());

        // Codes let citizen-facing clients build their own plain-language
        // timeline (per docs/mom-product-decisions.md §2) without parsing
        // the staff-oriented `event` string above, which stays as-is for
        // staff portals that want the literal status names.
        return [
            'id' => $row->id,
            'from_status_id' => $row->from_status_id,
            'from_status_code' => $row->fromStatus->code ?? null,
            'to_status_id' => $row->to_status_id,
            'to_status_code' => $row->toStatus->code ?? null,
            'actor_id' => $row->actor_id,
            'actor' => $row->actor->name ?? self::roleTitle($actorRole) ?? ($row->actor_id ? 'Official' : 'System'),
            'actor_role' => $actorRole,
            'event' => $event,
            'note' => $note,
            'at' => $row->created_at?->toIso8601String(),
            'created_at' => $row->created_at?->toIso8601String(),
            'metadata' => $row->metadata,
        ];
    }

    /**
     * @param  array<int, string>  $roles
     */
    private static function highestPriorityRole(array $roles): ?string
    {
        $priority = ['system', 'super_admin', 'moderator', 'department_officer', 'department', 'citizen'];

        foreach ($priority as $candidate) {
            if (in_array($candidate, $roles, true)) {
                return $candidate;
            }
        }

        return $roles[0] ?? null;
    }

    /**
     * Human title for an actor whose account has no display name (e.g. an
     * OTP-only citizen). Falls back to null so the caller's own default
     * ('Official'/'System') still applies to unrecognized roles.
     */
    private static function roleTitle(?string $role): ?string
    {
        return match ($role) {
            'citizen' => 'Citizen',
            'moderator' => 'Moderator',
            'department_officer', 'department' => 'Department Officer',
            'super_admin' => 'Admin',
            'system' => 'System',
            default => null,
        };
    }
}
