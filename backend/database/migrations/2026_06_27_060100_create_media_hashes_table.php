<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `media_hashes` table per docs/04 §9.
 *
 * One row per media asset carries the integrity / dedup hashes
 * computed by HashService (T-M5-005) and ComputeHashesJob
 * (T-M5-009). The full cryptographic chain is sha256 + sha512;
 * perceptual_hash (pHash, 16 hex chars per docs/04) powers the
 * duplicate detection pipeline, and video_fingerprint carries
 * the ffmpeg-based fingerprint for video deduplication.
 *
 * The pair (media_id, sha256) is unique so re-hashing the same
 * asset never produces a second row. A media row is deleted by
 * the chain-of-custody replacement flow (T-M5-016) — never by
 * direct cascade — so the FK uses restrictOnDelete to surface
 * any orphan logic.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_hashes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('media_id');
            $table->string('sha256', 64);
            $table->string('sha512', 128);
            $table->string('perceptual_hash', 16);
            $table->string('video_fingerprint', 128)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('media_id')
                ->references('id')->on('media')
                ->restrictOnDelete();

            $table->unique(['media_id', 'sha256']);
            $table->index('sha256');
            $table->index('perceptual_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_hashes');
    }
};
