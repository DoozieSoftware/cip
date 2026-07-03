<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $prefix = DB::getTablePrefix();

        // MySQL 5.7 cannot DROP PRIMARY KEY while a foreign key
        // constraint references any column in the PK. We must
        // drop the FKs first, then the PK, then modify the column,
        // then recreate the PK + index + FK.

        // --- model_has_roles ---
        $fkRolesName = $this->findForeignKeyName("{$prefix}model_has_roles", 'role_id');
        if ($fkRolesName !== null) {
            Schema::table('model_has_roles', function ($table) use ($fkRolesName): void {
                $table->dropForeign($fkRolesName);
            });
        }

        DB::statement('ALTER TABLE model_has_roles DROP PRIMARY KEY');
        DB::statement('DROP INDEX model_has_roles_model_id_model_type_index ON model_has_roles');
        DB::statement('ALTER TABLE model_has_roles MODIFY model_id CHAR(36) NOT NULL');
        DB::statement('ALTER TABLE model_has_roles ADD PRIMARY KEY (role_id, model_id, model_type)');
        DB::statement('CREATE INDEX model_has_roles_model_id_model_type_index ON model_has_roles (model_id, model_type)');

        Schema::table('model_has_roles', function ($table): void {
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });

        // --- model_has_permissions ---
        $fkPermsName = $this->findForeignKeyName("{$prefix}model_has_permissions", 'permission_id');
        if ($fkPermsName !== null) {
            Schema::table('model_has_permissions', function ($table) use ($fkPermsName): void {
                $table->dropForeign($fkPermsName);
            });
        }

        DB::statement('ALTER TABLE model_has_permissions DROP PRIMARY KEY');
        DB::statement('DROP INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions');
        DB::statement('ALTER TABLE model_has_permissions MODIFY model_id CHAR(36) NOT NULL');
        DB::statement('ALTER TABLE model_has_permissions ADD PRIMARY KEY (permission_id, model_id, model_type)');
        DB::statement('CREATE INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions (model_id, model_type)');

        Schema::table('model_has_permissions', function ($table): void {
            $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $prefix = DB::getTablePrefix();

        $fkRolesName = $this->findForeignKeyName("{$prefix}model_has_roles", 'role_id');
        if ($fkRolesName !== null) {
            Schema::table('model_has_roles', function ($table) use ($fkRolesName): void {
                $table->dropForeign($fkRolesName);
            });
        }

        DB::statement('ALTER TABLE model_has_roles DROP PRIMARY KEY');
        DB::statement('DROP INDEX model_has_roles_model_id_model_type_index ON model_has_roles');
        DB::statement('ALTER TABLE model_has_roles MODIFY model_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE model_has_roles ADD PRIMARY KEY (role_id, model_id, model_type)');
        DB::statement('CREATE INDEX model_has_roles_model_id_model_type_index ON model_has_roles (model_id, model_type)');

        Schema::table('model_has_roles', function ($table): void {
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });

        $fkPermsName = $this->findForeignKeyName("{$prefix}model_has_permissions", 'permission_id');
        if ($fkPermsName !== null) {
            Schema::table('model_has_permissions', function ($table) use ($fkPermsName): void {
                $table->dropForeign($fkPermsName);
            });
        }

        DB::statement('ALTER TABLE model_has_permissions DROP PRIMARY KEY');
        DB::statement('DROP INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions');
        DB::statement('ALTER TABLE model_has_permissions MODIFY model_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE model_has_permissions ADD PRIMARY KEY (permission_id, model_id, model_type)');
        DB::statement('CREATE INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions (model_id, model_type)');

        Schema::table('model_has_permissions', function ($table): void {
            $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
        });
    }

    /**
     * Find the constraint name for a foreign key on a given column.
     * MySQL 5.7 generates constraint names like `model_has_roles_role_id_foreign`
     * but they may differ if the server generated a hashed name.
     */
    private function findForeignKeyName(string $table, string $column): ?string
    {
        $row = DB::selectOne(
            "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND COLUMN_NAME = ?
               AND REFERENCED_TABLE_NAME IS NOT NULL
             LIMIT 1",
            [$table, $column],
        );

        return $row?->CONSTRAINT_NAME;
    }
};
