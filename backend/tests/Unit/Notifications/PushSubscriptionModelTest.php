<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Tests\TestCase;

uses(TestCase::class);

/**
 * PushSubscription is the `push_subscriptions` row (docs/04 §13).
 * These tests pin the storage contract — table, mass-assignable
 * fields, the JSON `keys` cast, and the owning-user relation —
 * without touching the database.
 */
it('targets the push_subscriptions table', function (): void {
    expect((new PushSubscription)->getTable())->toBe('push_subscriptions');
});

it('uses uuid keys', function (): void {
    expect(class_uses(PushSubscription::class))->toContain(HasUuids::class);
});

it('mass-assigns exactly the subscription fields', function (): void {
    expect((new PushSubscription)->getFillable())
        ->toBe(['user_id', 'endpoint', 'keys', 'content_encoding']);
});

it('casts the keys column to an array', function (): void {
    $subscription = new PushSubscription([
        'keys' => ['p256dh' => 'BExampleKey', 'auth' => 'authSecret'],
    ]);

    expect($subscription->keys)->toBe(['p256dh' => 'BExampleKey', 'auth' => 'authSecret']);
});

it('does not mass-assign the guarded id', function (): void {
    $subscription = new PushSubscription(['id' => 'attacker-supplied', 'endpoint' => 'https://push']);

    expect($subscription->id)->toBeNull()
        ->and($subscription->endpoint)->toBe('https://push');
});

it('belongs to the subscribing user', function (): void {
    $relation = (new PushSubscription)->user();

    expect($relation)->toBeInstanceOf(BelongsTo::class)
        ->and($relation->getForeignKeyName())->toBe('user_id')
        ->and($relation->getRelated())->toBeInstanceOf(User::class);
});
