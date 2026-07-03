<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE model_has_roles DROP PRIMARY KEY');
        DB::statement('DROP INDEX model_has_roles_model_id_model_type_index ON model_has_roles');
        DB::statement('ALTER TABLE model_has_roles MODIFY model_id CHAR(36) NOT NULL');
        DB::statement('ALTER TABLE model_has_roles ADD PRIMARY KEY (role_id, model_id, model_type)');
        DB::statement('CREATE INDEX model_has_roles_model_id_model_type_index ON model_has_roles (model_id, model_type)');

        DB::statement('ALTER TABLE model_has_permissions DROP PRIMARY KEY');
        DB::statement('DROP INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions');
        DB::statement('ALTER TABLE model_has_permissions MODIFY model_id CHAR(36) NOT NULL');
        DB::statement('ALTER TABLE model_has_permissions ADD PRIMARY KEY (permission_id, model_id, model_type)');
        DB::statement('CREATE INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions (model_id, model_type)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE model_has_roles DROP PRIMARY KEY');
        DB::statement('DROP INDEX model_has_roles_model_id_model_type_index ON model_has_roles');
        DB::statement('ALTER TABLE model_has_roles MODIFY model_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE model_has_roles ADD PRIMARY KEY (role_id, model_id, model_type)');
        DB::statement('CREATE INDEX model_has_roles_model_id_model_type_index ON model_has_roles (model_id, model_type)');

        DB::statement('ALTER TABLE model_has_permissions DROP PRIMARY KEY');
        DB::statement('DROP INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions');
        DB::statement('ALTER TABLE model_has_permissions MODIFY model_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE model_has_permissions ADD PRIMARY KEY (permission_id, model_id, model_type)');
        DB::statement('CREATE INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions (model_id, model_type)');
    }
};
