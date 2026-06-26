<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `media` table per docs/04 §9.
 *
 * One row per evidence asset attached to a report. The asset lives
 * on a Laravel filesystem disk (configured by `storage_disk` —
 * usually `minio` in production, `local` in tests) and is
 * identified inside that disk by `storage_path` (which is unique
 * platform-wide so the storage driver can use it as the object key).
 *
 * The base schema follows docs/04 §9. M5 extends it with the
 * per-asset metadata that the evidence-integrity and chain-of-
 * custody layers (T-M5-002, T-M5-016) need:
 *
 *   - width / height      : pixel dimensions (nullable - videos
 *                           and documents may not have them at
 *                           upload time, populated by
 *                           ExtractVideoMetadataJob T-M5-010)
 *   - uploaded_by         : UUID FK -> users.id (the citizen or
 *                           staff user that uploaded the asset)
 *   - metadata            : JSON column for per-asset extensions
 *                           (exif, GPS strip result, scanner
 *                           verdict, etc.)
 *   - version             : int - increments on replacement
 *                           (T-M5-016 chain-of-custody)
 *   - is_replaced         : bool - true once a newer version of
 *                           the same logical asset exists
 *
 * Driver note: the `type` column is a string in SQLite (Laravel's
 * `enum()` is emulated) and a native MySQL ENUM in production.
 * We use Laravel's `enum()` so the schema declaration is portable
 * across drivers.
 *
 * FK behaviour:
 *   - report_id   : restrictOnDelete (cannot delete a report that
 *                   still has evidence; replacements are the only
 *                   way to remove assets)
 *   - uploaded_by : nullOnDelete (preserve the asset even if the
 *                   uploader account is later removed)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->enum('type', ['PHOTO', 'VIDEO', 'DOCUMENT']);
            $table->string('storage_disk', 32);
            $table->string('storage_path', 512)->unique();
            $table->string('mime', 128);
            $table->unsignedBigInteger('size');
            $table->unsignedInteger('duration')->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->string('checksum', 64);
            $table->timestamp('captured_at')->nullable();
            $table->timestamp('uploaded_at')->useCurrent();
            $table->uuid('uploaded_by')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_replaced')->default(false);
            $table->timestamps();

            $table->foreign('report_id')
                ->references('id')->on('reports')
                ->restrictOnDelete();
            $table->foreign('uploaded_by')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index('report_id');
            $table->index('type');
            $table->index('uploaded_by');
            $table->index('checksum');
            $table->index(['report_id', 'type']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE media
                 ADD CONSTRAINT media_type_check
                 CHECK (type IN ('PHOTO','VIDEO','DOCUMENT'))"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE media DROP CONSTRAINT media_type_check');
        }
        Schema::dropIfExists('media');
    }
};
