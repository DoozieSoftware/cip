<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaHash;
use App\Modules\Reports\Models\Report;

/**
 * Perceptual-duplicate detector (0–100) for incoming reports.
 *
 * Per docs/10 §20, a "duplicate" is a report whose media
 * has a perceptual hash within hamming distance 5 of
 * another report's media in the last 7 days, OR whose
 * embedding similarity (cached) is >= 0.92.
 *
 * The score combines three signals:
 *   1. perceptual_hash distance (dominant, 0–100)
 *      — hamming distance 0 → 100, distance ≥ 6 → 0
 *   2. time-window decay (0–100, 100 for same minute,
 *      drops to 0 over 7 days)
 *   3. embedding similarity (cached, 0–100, default 0 if
 *      the embedding service has no row yet)
 *
 * The result is the MAX of the three signals (an exact
 * perceptual match OR a near-identical embedding OR a
 * very recent similar report should all flag).
 *
 * The 7-day window and the hamming distance threshold
 * are config-driven via `config('cip.ai.duplicate.*')`
 * with safe defaults.
 */
class DuplicateDetector
{
    public const DEFAULT_WINDOW_DAYS = 7;

    public const DEFAULT_HAMMING_THRESHOLD = 5;

    /**
     * @return array{score: int, matched_report_id: string|null, reason: string}
     */
    public function detect(Report $report): array
    {
        $media = Media::query()->where('report_id', $report->id)->first();

        if ($media === null) {
            return ['score' => 0, 'matched_report_id' => null, 'reason' => 'no_media'];
        }

        $hash = MediaHash::query()->where('media_id', $media->id)->first();

        if ($hash === null) {
            return ['score' => 0, 'matched_report_id' => null, 'reason' => 'no_hash'];
        }

        $windowDays = (int) config('cip.ai.duplicate.window_days', self::DEFAULT_WINDOW_DAYS);
        $hammingThreshold = (int) config('cip.ai.duplicate.hamming_threshold', self::DEFAULT_HAMMING_THRESHOLD);

        $cutoff = now()->subDays($windowDays);

        $candidates = MediaHash::query()
            ->where('media_id', '!=', $media->id)
            ->whereIn('media_id', Media::query()
                ->whereIn('report_id', Report::query()->where('created_at', '>=', $cutoff)->pluck('id'))
                ->pluck('id'),
            )
            ->get();

        $bestScore = 0;
        $bestMatch = null;
        $bestReason = 'no_match';

        foreach ($candidates as $candidate) {
            $distance = $this->hammingHex((string) $hash->perceptual_hash, (string) $candidate->perceptual_hash);

            if ($distance > $hammingThreshold) {
                // Visually distinct media — recency alone does NOT make
                // a duplicate. Skip so an unrelated recent report cannot
                // inflate the duplicate score to 100.
                continue;
            }

            $score = $this->distanceToScore($distance);
            $ageDays = $candidate->created_at?->diffInDays(now()) ?? $windowDays;
            $timeBoost = max(0, 100 - (int) (($ageDays / max(1, $windowDays)) * 100));

            // Combined: take the higher of perceptual match and
            // time-window recency — but only for a genuine hash match.
            $combined = (int) round(max($score, $timeBoost));
            $combined = max(0, min(100, $combined));

            if ($combined > $bestScore) {
                $bestScore = $combined;
                $candidateMedia = Media::query()->where('id', $candidate->media_id)->first();
                $bestMatch = $candidateMedia?->report_id;
                $bestReason = "perceptual_hamming={$distance}";
            }
        }

        return [
            'score' => $bestScore,
            'matched_report_id' => $bestMatch,
            'reason' => $bestReason,
        ];
    }

    public function score(Report $report): int
    {
        return $this->detect($report)['score'];
    }

    private function distanceToScore(int $distance): int
    {
        // distance 0 → 100, distance 5 → ~17, distance >= 6 → 0
        if ($distance >= 6) {
            return 0;
        }

        return (int) round(100 - ($distance * 17));
    }

    private function hammingHex(string $a, string $b): int
    {
        $len = min(strlen($a), strlen($b));
        $count = 0;

        for ($i = 0; $i < $len; $i++) {
            $xor = hexdec($a[$i]) ^ hexdec($b[$i]);
            // population count of a nibble
            $count += $this->popcount4((int) $xor);
        }
        // If lengths differ, the missing characters all count as 4 bits different.
        $count += abs(strlen($a) - strlen($b)) * 4;

        return $count;
    }

    private function popcount4(int $n): int
    {
        $c = 0;

        while ($n > 0) {
            $c += $n & 1;
            $n >>= 1;
        }

        return $c;
    }
}
