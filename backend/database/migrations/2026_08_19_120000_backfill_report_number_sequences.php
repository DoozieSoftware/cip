<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $years = Report::query()
            ->select('tracking_number')
            ->where('tracking_number', 'like', 'CIV-%')
            ->pluck('tracking_number')
            ->map(static function (mixed $trackingNumber): ?int {
                if (! is_string($trackingNumber)) {
                    return null;
                }

                if (! preg_match('/^CIV-(\d{4})-\d{6}$/', $trackingNumber, $matches)) {
                    return null;
                }

                return (int) $matches[1];
            })
            ->filter(static fn (?int $year): bool => $year !== null)
            ->unique()
            ->values();

        foreach ($years as $year) {
            $nextValue = Report::nextValueFromExistingReports($year);

            DB::transaction(function () use ($year, $nextValue): void {
                DB::table('report_number_sequences')->insertOrIgnore([
                    'year' => $year,
                    'next_value' => $nextValue,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $sequence = DB::table('report_number_sequences')
                    ->where('year', $year)
                    ->lockForUpdate()
                    ->first();

                $currentValue = is_object($sequence) && is_numeric($sequence->next_value)
                    ? (int) $sequence->next_value
                    : 1;

                DB::table('report_number_sequences')
                    ->where('year', $year)
                    ->update([
                        'next_value' => max($currentValue, $nextValue),
                        'updated_at' => now(),
                    ]);
            });
        }
    }

    public function down(): void
    {
        // Intentionally left empty: rolling this back could reintroduce
        // duplicate tracking number collisions in environments with data.
    }
};
