<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `role` to `media` so department-officer proof-of-completion
 * uploads can be distinguished from citizen evidence.
 *
 *  - `evidence` — citizen-submitted evidence (photos/video attached at
 *                 or after report submission; default, backfilled)
 *  - `proof`    — officer-uploaded proof-of-completion (before/after
 *                 resolution photos); department-private and hidden
 *                 from citizens
 *
 * The per-proof limit is enforced in MediaService scoped by role, so
 * citizen evidence counts never collide with officer uploads.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table): void {
            $table->string('role', 16)->default('evidence')->after('type');
            $table->index(['report_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::table('media', function (Blueprint $table): void {
            $table->dropIndex(['report_id', 'role']);
            $table->dropColumn('role');
        });
    }
};
