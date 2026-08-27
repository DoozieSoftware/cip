<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Models\TextileZoneUnavailability;
use Illuminate\Support\Carbon;

final class TextileUnavailabilityService
{
    /**
     * Return unavailable slots for a zone intersecting the range.
     *
     * @return list<array<string,mixed>>
     */
    public function listForZone(string $zoneId, ?string $from = null, ?string $to = null): array
    {
        $query = TextileZoneUnavailability::query()
            ->where('service_zone_id', $zoneId)
            ->orderBy('unavailable_date');

        if ($from !== null) {
            $query->where('unavailable_date', '>=', $from);
        }

        if ($to !== null) {
            $query->where('unavailable_date', '<=', $to);
        }

        return $query->get()->map(fn (TextileZoneUnavailability $u): array => [
            'id' => $u->id,
            'unavailable_date' => $u->unavailable_date->toDateString(),
            'window_start' => $u->window_start,
            'window_end' => $u->window_end,
            'reason' => $u->reason,
        ])->all();
    }

    /**
     * Throw if the requested slot is marked unavailable.
     */
    public function assertAvailable(string $zoneId, string $date, ?string $windowStart, ?string $windowEnd): void
    {
        $target = Carbon::parse($date)->toDateString();

        $conflict = TextileZoneUnavailability::query()
            ->where('service_zone_id', $zoneId)
            ->where('unavailable_date', $target)
            ->get()
            ->first(function (TextileZoneUnavailability $row) use ($windowStart, $windowEnd): bool {
                // Whole-day block (no window) blocks every request.
                if ($row->window_start === null && $row->window_end === null) {
                    return true;
                }

                // If request has no window, any blocked window on that day blocks it.
                if ($windowStart === null || $windowEnd === null) {
                    return true;
                }

                // Overlap check for windowed blocks.
                return $this->windowsOverlap($windowStart, $windowEnd, (string) $row->window_start, (string) $row->window_end);
            });

        if ($conflict === null) {
            return;
        }

        $suggestion = $this->suggestNextAvailable($zoneId, $target);

        throw new ApiException(
            'SLOT_UNAVAILABLE',
            'The requested pickup slot is unavailable.'.($conflict->reason ? ' Reason: '.$conflict->reason : '').($suggestion ? ' Suggested next available: '.$suggestion : ''),
            422,
            ['unavailable_reason' => $conflict->reason, 'suggestion' => $suggestion],
        );
    }

    private function windowsOverlap(string $aStart, string $aEnd, string $bStart, string $bEnd): bool
    {
        return $aStart < $bEnd && $bStart < $aEnd;
    }

    private function suggestNextAvailable(string $zoneId, string $fromDate): ?string
    {
        // Look ahead 14 days for the first non-unavailable date.
        $cursor = Carbon::parse($fromDate)->addDay();

        for ($i = 0; $i < 14; $i++) {
            $dateStr = $cursor->toDateString();
            $blockedWholeDay = TextileZoneUnavailability::query()
                ->where('service_zone_id', $zoneId)
                ->where('unavailable_date', $dateStr)
                ->whereNull('window_start')
                ->whereNull('window_end')
                ->exists();

            if (! $blockedWholeDay) {
                return $dateStr;
            }
            $cursor = $cursor->addDay();
        }

        return null;
    }
}
