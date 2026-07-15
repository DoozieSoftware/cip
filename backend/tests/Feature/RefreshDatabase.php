<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase as RefreshDatabaseTrait;
use Tests\TestCase;

/**
 * Base test case for Feature tests that need a migrated,
 * rolled-back-per-test database.
 *
 * The Laravel/Pest convention resolves `uses(RefreshDatabase::class)`
 * to this class; previously it was missing, so every Feature test
 * that touched the database failed to boot.
 */
abstract class RefreshDatabase extends TestCase
{
    use RefreshDatabaseTrait;
}
