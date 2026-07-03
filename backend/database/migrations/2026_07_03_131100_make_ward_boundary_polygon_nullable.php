<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // MariaDB requires spatial-indexed columns to be NOT NULL.
        // Kept as a no-op so deployments that already include this migration continue safely.
    }

    public function down(): void
    {
        // No-op.
    }
};
