<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->uuid('citizen_id')->nullable()->after('id');
            $table->string('reference', 32)->nullable()->after('citizen_id');
            $table->string('title')->nullable()->after('reference');
            $table->text('notes')->nullable()->after('title');
            $table->decimal('latitude', 10, 7)->nullable()->after('pickup_address');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->timestamp('submitted_at')->nullable()->after('picked_up_at');
        });

        $rows = DB::table('textile_collection_requests')
            ->leftJoin('reports', 'reports.id', '=', 'textile_collection_requests.report_id')
            ->select([
                'textile_collection_requests.id',
                'textile_collection_requests.created_at',
                'reports.citizen_id',
                'reports.title',
                'reports.description',
                'reports.submitted_at',
            ])
            ->orderBy('textile_collection_requests.created_at')
            ->get();

        $sequenceByYear = [];

        foreach ($rows as $row) {
            $createdAt = is_string($row->created_at) ? $row->created_at : (string) now();
            $year = substr($createdAt, 0, 4);
            $sequenceByYear[$year] = ($sequenceByYear[$year] ?? 0) + 1;

            DB::table('textile_collection_requests')->where('id', $row->id)->update([
                'citizen_id' => $row->citizen_id,
                'reference' => 'DLN-'.$year.'-'.str_pad((string) $sequenceByYear[$year], 6, '0', STR_PAD_LEFT),
                'title' => $row->title ?? 'Textile collection request',
                'notes' => $row->description,
                'submitted_at' => $row->submitted_at ?? $row->created_at,
            ]);
        }

        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->foreign('citizen_id')->references('id')->on('users')->restrictOnDelete();
            $table->unique('reference');
            $table->index(['citizen_id', 'created_at']);
        });

        // Keep report_id only as a nullable legacy link for requests created
        // before this module was separated from the complaint workflow.
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->dropForeign(['report_id']);
        });
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->uuid('report_id')->nullable()->change();
            $table->foreign('report_id')->references('id')->on('reports')->cascadeOnDelete();
        });

        // Clothes collection is now a partner service, not a report type.
        // Keep the row for historical reports while removing it from citizen
        // complaint forms and AI classification choices.
        DB::table('report_types')
            ->where('code', 'clothes_waste')
            ->update(['active' => false, 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('report_types')
            ->where('code', 'clothes_waste')
            ->update(['active' => true, 'updated_at' => now()]);

        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->dropForeign(['citizen_id']);
            $table->dropUnique(['reference']);
            $table->dropIndex(['citizen_id', 'created_at']);
            $table->dropColumn([
                'citizen_id', 'reference', 'title', 'notes', 'latitude',
                'longitude', 'submitted_at',
            ]);
        });
    }
};
