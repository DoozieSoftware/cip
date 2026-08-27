<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Policies;

use App\Modules\Shared\Policies\BasePolicy;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;

/**
 * Gate-based policy for the TextileCollections module.
 *
 * Ability names are module-scoped (textile.*) to avoid silently
 * replacing other modules' abilities (per AGENTS.md).
 */
final class TextileCollectionPolicy extends BasePolicy
{
    public function viewQueue(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function view(User $user, TextileCollectionRequest $collection): bool
    {
        // Collection partner members may view.
        if ($this->isCollectionPartner($user)) {
            // Allow if the user is a member of the assigned partner.
            if ($this->isCollectionPartner($user, (string) $collection->department_id)) {
                return true;
            }
        }

        return (string) $collection->citizen_id === (string) $user->id;
    }

    public function scheduleBatch(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function recordOutcome(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function cancel(User $user, TextileCollectionRequest $collection): bool
    {
        return (string) $collection->citizen_id === (string) $user->id;
    }

    public function report(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function approve(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function recordReceipt(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function reverseReceipt(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function manageCentre(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function assignTrip(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function operateTrip(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function reschedule(User $user, TextileCollectionRequest $collection): bool
    {
        // Citizen owns the booking; partner override is checked in controller via isCollectionPartner.
        return (string) $collection->citizen_id === (string) $user->id || $this->isCollectionPartner($user, (string) $collection->department_id);
    }

    public function updateInstructions(User $user, TextileCollectionRequest $collection): bool
    {
        return (string) $collection->citizen_id === (string) $user->id;
    }

    public function viewUnavailability(User $user): bool
    {
        return true;
    }

    public function manageUnavailability(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    public function rescheduleOverride(User $user): bool
    {
        return $this->isCollectionPartner($user);
    }

    /**
     * Check if the user is a member of a department that has ≥1
     * textile_partner_capabilities row (optionally matching the
     * given department id).
     */
    private function isCollectionPartner(User $user, ?string $departmentId = null): bool
    {
        $query = $user->departments()
            ->where('departments.active', true)
            ->whereHas('textilePartnerCapabilities', function ($capQuery) use ($departmentId): void {
                if ($departmentId !== null) {
                    $capQuery->where('department_id', $departmentId);
                }
            });

        if ($departmentId !== null) {
            $query->where('departments.id', $departmentId);
        }

        return $query->exists();
    }
}
